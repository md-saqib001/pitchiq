/**
 * controllers/playerController.js — Player stats, trends, breakdowns, and innings
 */

const { buildBattingFilters, buildBowlingFilters, formatFloat, getDbSeason } = require('../utils/helpers');

// ──────────────────────────────────────────────
// GET /api/player/:name/stats
// ──────────────────────────────────────────────
exports.getBattingStats = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const filters = buildBattingFilters(req.query);

        let query = `
            SELECT 
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as strike_rate,
                SUM(d.runs_batter) as total_runs,
                COUNT(DISTINCT d.match_id) as matches,
                COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END) as dismissals,
                (SUM(CASE WHEN d.runs_batter IN (4, 6) THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0)) * 100 as boundary_rate,
                SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
                SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
                SUM(CASE WHEN d.runs_batter = 0 AND d.extras_type IS NULL THEN 1 ELSE 0 END) as dots,
                COUNT(CASE WHEN (d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%')) THEN 1 END) as balls_faced
            FROM deliveries d
            JOIN innings i ON d.innings_id = i.id
            JOIN matches m ON d.match_id = m.id
            WHERE d.batter = ?
        `;
        const params = [name, ...filters.params];
        query += filters.clauses;

        const stats = db.prepare(query).get(...params);
        res.json({
           ...stats,
           dot_percentage: stats.balls_faced > 0 ? ((stats.dots / stats.balls_faced) * 100).toFixed(2) : 0
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/bowling_stats
// ──────────────────────────────────────────────
exports.getBowlingStats = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const filters = buildBowlingFilters(req.query);

        let query = `
            SELECT 
                SUM(d.runs_total) as runs_conceded,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls,
                SUM(CASE WHEN d.runs_total = 0 THEN 1 ELSE 0 END) as dot_balls,
                COUNT(DISTINCT d.match_id) as matches
            FROM deliveries d
            JOIN innings i ON d.innings_id = i.id
            JOIN matches m ON d.match_id = m.id
            WHERE d.bowler = ?
        `;
        const params = [name, ...filters.params];
        query += filters.clauses;

        const stats = db.prepare(query).get(...params);

        const overs = stats.legal_balls / 6.0;
        stats.economy = overs > 0 ? (stats.runs_conceded / overs).toFixed(2) : 0;
        stats.average = stats.wickets > 0 ? (stats.runs_conceded / stats.wickets).toFixed(2) : 0;
        stats.strike_rate = stats.wickets > 0 ? (stats.legal_balls / stats.wickets).toFixed(2) : 0;

        res.json(stats);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/season_trend
// ──────────────────────────────────────────────
exports.getSeasonTrend = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;

        // Batting trend
        const battingQuery = `
            SELECT 
                m.season,
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as sr,
                SUM(d.runs_batter) as runs,
                (SUM(CASE WHEN d.runs_batter IN (4, 6) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0)) as boundary_rate
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE d.batter = ?
            GROUP BY m.season
        `;
        const battingData = db.prepare(battingQuery).all(name);

        // Bowling trend
        const bowlingQuery = `
            SELECT 
                m.season,
                SUM(d.runs_total) as runs_conceded,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE d.bowler = ?
            GROUP BY m.season
        `;
        const bowlingData = db.prepare(bowlingQuery).all(name);

        // Merge in JS
        const seasonMap = {};
        battingData.forEach(d => {
            seasonMap[d.season] = {
                season: d.season,
                avg: formatFloat(d.avg),
                sr: formatFloat(d.sr),
                runs: d.runs || 0,
                boundary_rate: formatFloat(d.boundary_rate),
                bowling_wickets: 0,
                bowling_economy: 0,
                bowling_average: 0,
                bowling_strike_rate: 0
            };
        });

        bowlingData.forEach(d => {
            const overs = d.legal_balls / 6.0;
            const economy = overs > 0 ? parseFloat((d.runs_conceded / overs).toFixed(2)) : 0;
            const average = d.wickets > 0 ? parseFloat((d.runs_conceded / d.wickets).toFixed(2)) : 0;
            const strike_rate = d.wickets > 0 ? parseFloat((d.legal_balls / d.wickets).toFixed(2)) : 0;

            if (!seasonMap[d.season]) {
                seasonMap[d.season] = {
                    season: d.season,
                    avg: 0,
                    sr: 0,
                    runs: 0,
                    boundary_rate: 0
                };
            }
            seasonMap[d.season].bowling_wickets = d.wickets || 0;
            seasonMap[d.season].bowling_economy = economy;
            seasonMap[d.season].bowling_average = average;
            seasonMap[d.season].bowling_strike_rate = strike_rate;
        });

        const merged = Object.values(seasonMap).sort((a, b) => a.season.localeCompare(b.season));
        res.json(merged);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/phase_breakdown
// ──────────────────────────────────────────────
exports.getPhaseBreakdown = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const { venue, situation, season: rawSeason } = req.query;
        const season = getDbSeason(rawSeason);

        let query = `
            SELECT 
                d.match_phase as phase,
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as sr,
                SUM(d.runs_batter) as runs,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as balls,
                COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END) as dismissals
            FROM deliveries d
            JOIN innings i ON d.innings_id = i.id
            JOIN matches m ON d.match_id = m.id
            WHERE d.batter = ?
        `;
        const params = [name];
        if (venue) { query += ` AND m.venue LIKE ?`; params.push(`%${venue}%`); }
        if (situation === 'chase') query += ` AND i.is_chase = 1`;
        else if (situation === 'defend') query += ` AND i.is_chase = 0`;
        if (season && season !== 'all') { query += ` AND m.season = ?`; params.push(season); }

        query += ` GROUP BY d.match_phase ORDER BY CASE d.match_phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 WHEN 'death' THEN 3 END`;

        const data = db.prepare(query).all(...params);
        data.forEach(d => {
            d.avg = formatFloat(d.avg);
            d.sr = formatFloat(d.sr);
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/bowling_phase_breakdown
// ──────────────────────────────────────────────
exports.getBowlingPhaseBreakdown = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const { venue, situation, season: rawSeason } = req.query;
        const season = getDbSeason(rawSeason);

        let query = `
            SELECT 
                d.match_phase as phase,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                SUM(d.runs_total) as runs,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls
            FROM deliveries d
            JOIN innings i ON d.innings_id = i.id
            JOIN matches m ON d.match_id = m.id
            WHERE d.bowler = ?
        `;
        const params = [name];
        if (venue) { query += ` AND m.venue LIKE ?`; params.push(`%${venue}%`); }
        if (situation === 'chase') {
            query += ` AND i.is_chase = 0`;
        } else if (situation === 'defend') {
            query += ` AND i.is_chase = 1`;
        }
        if (season && season !== 'all') { query += ` AND m.season = ?`; params.push(season); }

        query += ` GROUP BY d.match_phase ORDER BY CASE d.match_phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 WHEN 'death' THEN 3 END`;

        const data = db.prepare(query).all(...params);
        data.forEach(d => {
            const overs = d.legal_balls / 6.0;
            d.economy = overs > 0 ? parseFloat((d.runs / overs).toFixed(2)) : 0;
            d.strike_rate = d.wickets > 0 ? parseFloat((d.legal_balls / d.wickets).toFixed(2)) : 0;
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/venue_stats
// ──────────────────────────────────────────────
exports.getVenueStats = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const query = `
            SELECT 
                m.venue,
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as sr,
                SUM(d.runs_batter) as runs,
                COUNT(DISTINCT d.match_id) as matches,
                COUNT(DISTINCT d.match_id || '_' || d.innings_id) as innings
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE d.batter = ?
            GROUP BY m.venue
            ORDER BY avg DESC
        `;
        const data = db.prepare(query).all(name);
        data.forEach(d => {
            d.avg = formatFloat(d.avg);
            d.sr = formatFloat(d.sr);
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/bowling_venue_stats
// ──────────────────────────────────────────────
exports.getBowlingVenueStats = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const query = `
            SELECT 
                m.venue,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                SUM(d.runs_total) as runs,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls,
                COUNT(DISTINCT d.match_id) as matches
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE d.bowler = ?
            GROUP BY m.venue
            ORDER BY wickets DESC
        `;
        const data = db.prepare(query).all(name);
        data.forEach(d => {
            const overs = d.legal_balls / 6.0;
            d.economy = overs > 0 ? parseFloat((d.runs / overs).toFixed(2)) : 0;
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/compare_stats
// ──────────────────────────────────────────────
exports.getCompareStats = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const query = `
            SELECT 
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as sr,
                SUM(d.runs_batter) as runs,
                (SUM(CASE WHEN d.runs_batter IN (4, 6) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0)) as boundary_rate,
                COUNT(DISTINCT d.match_id) as matches,
                COUNT(DISTINCT d.match_id || '_' || d.innings_id) as innings
            FROM deliveries d
            WHERE d.batter = ?
        `;
        const stats = db.prepare(query).get(name);

        // Get phase-specific SRs
        const phaseSR = db.prepare(`
            SELECT 
                d.match_phase,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as sr
            FROM deliveries d
            WHERE d.batter = ?
            GROUP BY d.match_phase
        `).all(name);

        const ppSR = phaseSR.find(p => p.match_phase === 'powerplay');
        const deathSR = phaseSR.find(p => p.match_phase === 'death');

        res.json({
            avg: formatFloat(stats.avg),
            sr: formatFloat(stats.sr),
            runs: stats.runs || 0,
            boundary_rate: formatFloat(stats.boundary_rate),
            matches: stats.matches || 0,
            innings: stats.innings || 0,
            powerplay_sr: ppSR && ppSR.sr ? formatFloat(ppSR.sr) : 0,
            death_sr: deathSR && deathSR.sr ? formatFloat(deathSR.sr) : 0,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/recent_innings
// ──────────────────────────────────────────────
exports.getRecentInnings = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const query = `
            SELECT 
                d.match_id,
                d.innings_id,
                m.date,
                m.season,
                m.team1,
                m.team2,
                SUM(d.runs_batter) as runs,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as balls,
                SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
                SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
                MAX(CASE WHEN d.player_out = ? THEN d.dismissal_kind ELSE NULL END) as dismissal,
                MAX(CASE WHEN d.player_out = ? THEN d.bowler ELSE NULL END) as bowler,
                MAX(CASE WHEN d.player_out = ? THEN d.fielder ELSE NULL END) as fielder
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE d.batter = ?
            GROUP BY d.match_id, d.innings_id
            ORDER BY m.date DESC
            LIMIT 10
        `;
        const data = db.prepare(query).all(name, name, name, name);
        data.forEach(d => {
            d.strike_rate = d.balls > 0 ? parseFloat(((d.runs / d.balls) * 100).toFixed(2)) : 0;
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/player/:name/bowling_recent_innings
// ──────────────────────────────────────────────
exports.getBowlingRecentInnings = (req, res) => {
    try {
        const db = req.db;
        const name = req.params.name;
        const query = `
            SELECT 
                d.match_id,
                d.innings_id,
                m.date,
                m.season,
                m.team1,
                m.team2,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                SUM(d.runs_total) as runs,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE d.bowler = ?
            GROUP BY d.match_id, d.innings_id
            ORDER BY m.date DESC
            LIMIT 10
        `;
        const data = db.prepare(query).all(name);
        data.forEach(d => {
            const oversInteger = Math.floor(d.legal_balls / 6);
            const oversFraction = d.legal_balls % 6;
            d.overs_str = `${oversInteger}.${oversFraction}`;
            d.economy = d.legal_balls > 0 ? parseFloat(((d.runs / d.legal_balls) * 6).toFixed(2)) : 0;
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};
