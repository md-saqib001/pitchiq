/**
 * controllers/metaController.js — AI query parser, IPL averages, and resource lookups
 */

const { getDbSeason } = require('../utils/helpers');

// ──────────────────────────────────────────────
// POST /api/ask
// ──────────────────────────────────────────────
exports.askPitchIQ = (req, res) => {
    try {
        const db = req.db;
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: "Query required" });

        const qLower = query.toLowerCase();

        // Very basic natural language parser for specific patterns
        let phase = null;
        if (qLower.includes('powerplay')) phase = 'powerplay';
        else if (qLower.includes('middle overs') || qLower.includes('middle')) phase = 'middle';
        else if (qLower.includes('death overs') || qLower.includes('death')) phase = 'death';

        let situation = null;
        if (qLower.includes('chasing') || qLower.includes('chase')) situation = 'chase';
        else if (qLower.includes('defending') || qLower.includes('defend')) situation = 'defend';

        let target_min = null;
        const targetMatch = qLower.match(/1[5-9]0\+/);
        if (targetMatch && situation === 'chase') {
            target_min = parseInt(targetMatch[0]);
        }

        let season = null;
        const seasonMatch = qLower.match(/20[0-2][0-9]/);
        if (seasonMatch) {
            season = seasonMatch[0];
        }

        let venue = null;
        if (qLower.includes('chinnaswamy')) venue = 'M Chinnaswamy Stadium';
        else if (qLower.includes('wankhede')) venue = 'Wankhede Stadium';
        else if (qLower.includes('eden gardens')) venue = 'Eden Gardens';
        else if (qLower.includes('chepauk')) venue = 'MA Chidambaram Stadium';

        let batter = null;
        let isBestBatsman = qLower.includes('best') && (qLower.includes('batsman') || qLower.includes('batter'));
        let isBestBowler = qLower.includes('best') && qLower.includes('bowler');

        if (qLower.includes('kohli')) batter = 'V Kohli';
        else if (qLower.includes('dhoni')) batter = 'MS Dhoni';
        else if (qLower.includes('rohit') || qLower.includes('sharma')) batter = 'RG Sharma';
        else if (qLower.includes('maxwell')) batter = 'GJ Maxwell';
        else if (qLower.includes('bumrah') && qLower.includes('economy')) batter = 'JJ Bumrah'; // Actually bowler

        let result = {};

        if (batter && !isBestBatsman && !isBestBowler) {
            // Re-use logic for player stats
            let sql = `
            SELECT 
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as strike_rate,
                SUM(d.runs_batter) as total_runs,
                COUNT(DISTINCT d.match_id) as matches,
                COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END) as dismissals,
                (SUM(CASE WHEN d.runs_batter IN (4, 6) THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0)) * 100 as boundary_rate,
                SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
                SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
                COUNT(CASE WHEN (d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%')) THEN 1 END) as balls_faced
            FROM deliveries d
            JOIN innings i ON d.innings_id = i.id
            JOIN matches m ON d.match_id = m.id
            WHERE 1=1 AND ${query.includes('economy') ? 'd.bowler' : 'd.batter'} = ?`;

            let params = [batter];
            let descParts = [`${batter}'s stats`];

            if (phase) { sql += ` AND d.match_phase = ?`; params.push(phase); descParts.push(`in ${phase} overs`); }
            if (situation === 'chase') { sql += ` AND i.is_chase = 1`; descParts.push('while chasing'); }
            if (situation === 'defend') { sql += ` AND i.is_chase = 0`; descParts.push('while defending'); }
            if (target_min) { sql += ` AND i.target >= ?`; params.push(target_min); descParts.push(target_min + '+'); }
            if (venue) { sql += ` AND m.venue LIKE ?`; params.push(`%${venue}%`); descParts.push(`at ${venue}`); }
            if (season) { sql += ` AND m.season = ?`; params.push(getDbSeason(season)); descParts.push(`in ${season}`); }

            result = {
                type: 'player_stats',
                description: descParts.join(' '),
                sql: db.prepare(sql).source,
                data: db.prepare(sql).get(...params),
                params: {
                    name: batter,
                    phase: phase,
                    venue: venue,
                    situation: situation,
                    target_min: target_min,
                    season: season
                }
            };
            if (result.data) {
                result.data.avg = result.data.avg ? result.data.avg.toFixed(2) : '-';
                result.data.strike_rate = result.data.strike_rate ? result.data.strike_rate.toFixed(2) : '-';
                result.data.boundary_rate = result.data.boundary_rate ? result.data.boundary_rate.toFixed(2) : '-';
            }
        }
        else if (isBestBatsman) {
             let sql = `
                SELECT d.batter as name, SUM(d.runs_batter) as value
                FROM deliveries d JOIN matches m ON d.match_id = m.id
                WHERE 1=1`;
             let params = [];
             let descParts = [`Best batters`];
             if (phase) { sql += ` AND d.match_phase = ?`; params.push(phase); descParts.push(`in ${phase} overs`); }
             if (season) { sql += ` AND m.season = ?`; params.push(getDbSeason(season)); descParts.push(`in ${season}`); }
             if (venue) { sql += ` AND m.venue LIKE ?`; params.push(`%${venue}%`); descParts.push(`at ${venue}`); }

             sql += ` GROUP BY d.batter ORDER BY value DESC LIMIT 5`;
             result = {
                 type: 'leaderboard',
                 description: descParts.join(' '),
                 sql: db.prepare(sql).source,
                 data: db.prepare(sql).all(...params)
             };
        }
        else if (isBestBowler) {
             let sql = `
                SELECT d.bowler as name, (SUM(d.runs_total) * 1.0) / (COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) / 6.0) as value
                FROM deliveries d JOIN matches m ON d.match_id = m.id
                WHERE 1=1`;
             let params = [];
             let descParts = [`Best bowlers by economy`];
             if (phase) { sql += ` AND d.match_phase = ?`; params.push(phase); descParts.push(`in ${phase} overs`); }
             if (season) { sql += ` AND m.season = ?`; params.push(getDbSeason(season)); descParts.push(`in ${season}`); }
             if (venue) { sql += ` AND m.venue LIKE ?`; params.push(`%${venue}%`); descParts.push(`at ${venue}`); }

             sql += ` GROUP BY d.bowler HAVING COUNT(*) > 60 ORDER BY value ASC LIMIT 5`;
             result = {
                 type: 'leaderboard',
                 description: descParts.join(' '),
                 sql: db.prepare(sql).source,
                 data: db.prepare(sql).all(...params).map(r => ({ ...r, value: r.value.toFixed(2) }))
             };
        } else {
             return res.status(400).json({error: "Could not parse query. Try including a player name or asking for 'best batsman/bowler'."});
        }

        // Add the SQL text to the data explicitly for clarity since sometimes node bindings strip it
        result.sql = result.sql || 'SQL Execution Output';

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/ipl_averages
// ──────────────────────────────────────────────
exports.getIPLAverages = (req, res) => {
    try {
        const db = req.db;
        const query = `
            SELECT 
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as strike_rate,
                (SUM(CASE WHEN d.runs_batter IN (4, 6) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0)) as boundary_rate
            FROM deliveries d
        `;
        const data = db.prepare(query).get();
        data.avg = data.avg ? parseFloat(data.avg.toFixed(2)) : 0;
        data.strike_rate = data.strike_rate ? parseFloat(data.strike_rate.toFixed(2)) : 0;
        data.boundary_rate = data.boundary_rate ? parseFloat(data.boundary_rate.toFixed(2)) : 0;

        // Add bowling averages benchmarks
        const bowlingQuery = `
            SELECT 
                SUM(d.runs_total) as runs,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls
            FROM deliveries d
        `;
        const bData = db.prepare(bowlingQuery).get();
        const bOvers = bData.legal_balls / 6.0;
        data.bowling_economy = bOvers > 0 ? parseFloat((bData.runs / bOvers).toFixed(2)) : 0;
        data.bowling_avg = bData.wickets > 0 ? parseFloat((bData.runs / bData.wickets).toFixed(2)) : 0;
        data.bowling_sr = bData.wickets > 0 ? parseFloat((bData.legal_balls / bData.wickets).toFixed(2)) : 0;

        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/venues
// ──────────────────────────────────────────────
exports.getVenues = (req, res) => {
    try {
        const db = req.db;
        res.json(db.prepare(`SELECT venue, COUNT(*) as match_count FROM matches GROUP BY venue ORDER BY match_count DESC`).all());
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ──────────────────────────────────────────────
// GET /api/teams
// ──────────────────────────────────────────────
exports.getTeams = (req, res) => {
    try {
        const db = req.db;
        res.json(db.prepare(`SELECT team, SUM(matches) as match_count FROM (SELECT team1 as team, COUNT(*) as matches FROM matches GROUP BY team1 UNION ALL SELECT team2 as team, COUNT(*) as matches FROM matches GROUP BY team2) GROUP BY team ORDER BY match_count DESC`).all());
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ──────────────────────────────────────────────
// GET /api/players
// ──────────────────────────────────────────────
exports.getPlayers = (req, res) => {
    try {
        const db = req.db;
        res.json(db.prepare(`SELECT DISTINCT batter as name FROM deliveries ORDER BY batter ASC`).all().map(r => r.name));
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ──────────────────────────────────────────────
// GET /api/players/summary
// ──────────────────────────────────────────────
exports.getPlayersSummary = (req, res) => {
    try {
        const db = req.db;
        const { q = '', page = 1, limit = 20, sort = 'total_runs' } = req.query;

        let innerQuery = `
            SELECT DISTINCT batter as name FROM deliveries
            UNION
            SELECT DISTINCT bowler as name FROM deliveries
        `;
        let params = [];

        if (q.trim()) {
            innerQuery = `
                SELECT DISTINCT batter as name FROM deliveries WHERE batter LIKE ?
                UNION
                SELECT DISTINCT bowler as name FROM deliveries WHERE bowler LIKE ?
            `;
            params.push(`%${q}%`, `%${q}%`);
        }

        // Count query
        const totalCount = db.prepare(`SELECT COUNT(DISTINCT name) as count FROM (${innerQuery})`).get(...params).count;

        // Main select query
        let selectQuery = `
            SELECT 
                p.name,
                COALESCE((SELECT SUM(runs_batter) FROM deliveries WHERE batter = p.name), 0) as total_runs,
                COALESCE((SELECT COUNT(*) FROM deliveries WHERE bowler = p.name AND dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket')), 0) as total_wickets
            FROM (${innerQuery}) p
        `;

        if (sort === 'total_wickets') {
            selectQuery += ` ORDER BY total_wickets DESC, total_runs DESC`;
        } else if (sort === 'name') {
            selectQuery += ` ORDER BY p.name ASC`;
        } else {
            selectQuery += ` ORDER BY total_runs DESC, total_wickets DESC`;
        }

        selectQuery += ` LIMIT ? OFFSET ?`;
        const selectParams = [...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)];

        const playersList = db.prepare(selectQuery).all(...selectParams);

        res.json({
            players: playersList,
            totalPlayers: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};
