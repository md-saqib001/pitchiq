/**
 * controllers/leaderboardController.js — Batting, bowling, and all-rounder leaderboards
 */

const { getDbSeason } = require('../utils/helpers');

// ──────────────────────────────────────────────
// GET /api/leaderboard/batting
// ──────────────────────────────────────────────
exports.getBattingLeaderboard = (req, res) => {
    try {
        const db = req.db;
        const { season: rawSeason, limit = 25, phase, metric = 'total_runs', min_innings = 0 } = req.query;
        const season = getDbSeason(rawSeason);

        const validMetrics = ['total_runs', 'average', 'strike_rate', 'boundary_rate'];
        const orderBy = validMetrics.includes(metric) ? metric : 'total_runs';

        let query = `
            SELECT 
                d.batter as name,
                SUM(d.runs_batter) as total_runs,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as strike_rate,
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as average,
                (SUM(CASE WHEN d.runs_batter IN (4, 6) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0)) as boundary_rate,
                COUNT(DISTINCT d.match_id || '_' || d.innings_id) as innings
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE 1=1
        `;
        let params = [];

        if (season && season !== 'all') { query += ` AND m.season = ?`; params.push(season); }
        if (phase && phase !== 'all') { query += ` AND d.match_phase = ?`; params.push(phase); }

        query += ` GROUP BY d.batter`;
        if (parseInt(min_innings) > 0) {
            query += ` HAVING innings >= ?`;
            params.push(parseInt(min_innings));
        }
        query += ` ORDER BY ${orderBy} DESC LIMIT ?`;
        params.push(parseInt(limit));

        const top = db.prepare(query).all(...params);
        top.forEach(t => {
            if (t.strike_rate) t.strike_rate = parseFloat(t.strike_rate.toFixed(2));
            if (t.average) t.average = parseFloat(t.average.toFixed(2));
            if (t.boundary_rate) t.boundary_rate = parseFloat(t.boundary_rate.toFixed(2));
        });
        res.json(top);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/leaderboard/bowling
// ──────────────────────────────────────────────
exports.getBowlingLeaderboard = (req, res) => {
    try {
        const db = req.db;
        const { season: rawSeason, limit = 25, phase, metric = 'wickets', min_innings = 0 } = req.query;
        const season = getDbSeason(rawSeason);

        let query = `
            SELECT 
                d.bowler as name,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                SUM(d.runs_total) as runs_conceded,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls,
                COUNT(DISTINCT d.match_id) as matches,
                COUNT(DISTINCT d.match_id || '_' || d.innings_id) as innings
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE 1=1
        `;
        let params = [];

        if (season && season !== 'all') { query += ` AND m.season = ?`; params.push(season); }
        if (phase && phase !== 'all') { query += ` AND d.match_phase = ?`; params.push(phase); }

        query += ` GROUP BY d.bowler`;
        if (parseInt(min_innings) > 0) {
            query += ` HAVING innings >= ?`;
            params.push(parseInt(min_innings));
        }
        // Fetch extra rows for JS-side re-sorting by computed metrics
        query += ` ORDER BY wickets DESC LIMIT ?`;
        params.push(parseInt(limit) * 3);

        let data = db.prepare(query).all(...params);

        // Compute derived bowling metrics
        data.forEach(d => {
            const overs = d.legal_balls / 6.0;
            d.economy = overs > 0 ? parseFloat((d.runs_conceded / overs).toFixed(2)) : 99;
            d.bowling_average = d.wickets > 0 ? parseFloat((d.runs_conceded / d.wickets).toFixed(2)) : 999;
            d.bowling_strike_rate = d.wickets > 0 ? parseFloat((d.legal_balls / d.wickets).toFixed(2)) : 999;
        });

        // Re-sort by the requested metric
        const validMetrics = ['wickets', 'economy', 'bowling_average', 'bowling_strike_rate'];
        const orderBy = validMetrics.includes(metric) ? metric : 'wickets';

        if (orderBy === 'wickets') {
            data.sort((a, b) => b.wickets - a.wickets);
        } else if (orderBy === 'economy') {
            data.sort((a, b) => a.economy - b.economy);
        } else if (orderBy === 'bowling_average') {
            data.sort((a, b) => a.bowling_average - b.bowling_average);
        } else if (orderBy === 'bowling_strike_rate') {
            data.sort((a, b) => a.bowling_strike_rate - b.bowling_strike_rate);
        }

        data = data.slice(0, parseInt(limit));
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/leaderboard/allrounder
// ──────────────────────────────────────────────
// Formula: AR Score = Batting Impact + Bowling Impact
//   Batting Impact = (Batting Avg × Strike Rate) / 100
//   Bowling Impact = 10000 / (Economy × Bowling Strike Rate)
// Requires minimum runs AND wickets to qualify
exports.getAllrounderLeaderboard = (req, res) => {
    try {
        const db = req.db;
        const { season: rawSeason, limit = 25, min_runs = 500, min_wickets = 30 } = req.query;
        const season = getDbSeason(rawSeason);

        // Batting stats
        let battingQuery = `
            SELECT 
                d.batter as name,
                SUM(d.runs_batter) as total_runs,
                SUM(d.runs_batter) * 1.0 / NULLIF(COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END), 0) as batting_avg,
                (SUM(d.runs_batter) * 100.0) / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) as batting_sr,
                COUNT(DISTINCT d.match_id) as batting_matches
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE 1=1
        `;
        let battingParams = [];
        if (season && season !== 'all') { battingQuery += ` AND m.season = ?`; battingParams.push(season); }
        battingQuery += ` GROUP BY d.batter`;

        // Bowling stats
        let bowlingQuery = `
            SELECT 
                d.bowler as name,
                COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                SUM(d.runs_total) as runs_conceded,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls,
                COUNT(DISTINCT d.match_id) as bowling_matches
            FROM deliveries d
            JOIN matches m ON d.match_id = m.id
            WHERE 1=1
        `;
        let bowlingParams = [];
        if (season && season !== 'all') { bowlingQuery += ` AND m.season = ?`; bowlingParams.push(season); }
        bowlingQuery += ` GROUP BY d.bowler`;

        const battingData = db.prepare(battingQuery).all(...battingParams);
        const bowlingData = db.prepare(bowlingQuery).all(...bowlingParams);

        // Build lookup maps
        const battingMap = {};
        battingData.forEach(d => { battingMap[d.name] = d; });
        const bowlingMap = {};
        bowlingData.forEach(d => { bowlingMap[d.name] = d; });

        // Merge: only players who appear in BOTH batting and bowling
        const allrounders = [];
        const allNames = new Set([...Object.keys(battingMap), ...Object.keys(bowlingMap)]);

        for (const name of allNames) {
            const bat = battingMap[name];
            const bowl = bowlingMap[name];
            if (!bat || !bowl) continue;
            if (bat.total_runs < parseInt(min_runs) || bowl.wickets < parseInt(min_wickets)) continue;

            const battingAvg = bat.batting_avg || 0;
            const battingSR = bat.batting_sr || 0;
            const overs = bowl.legal_balls / 6.0;
            const economy = overs > 0 ? bowl.runs_conceded / overs : 99;
            const bowlingAvg = bowl.wickets > 0 ? bowl.runs_conceded / bowl.wickets : 999;
            const bowlingSR = bowl.wickets > 0 ? bowl.legal_balls / bowl.wickets : 999;

            // All-rounder Rating Formula
            const battingImpact = (battingAvg * battingSR) / 100;
            const bowlingImpact = (economy > 0 && bowlingSR > 0) ? 10000 / (economy * bowlingSR) : 0;
            const allrounderScore = battingImpact + bowlingImpact;

            allrounders.push({
                name,
                total_runs: bat.total_runs,
                batting_avg: parseFloat(battingAvg.toFixed(2)),
                batting_sr: parseFloat(battingSR.toFixed(2)),
                wickets: bowl.wickets,
                economy: parseFloat(economy.toFixed(2)),
                bowling_avg: parseFloat(bowlingAvg.toFixed(2)),
                bowling_sr: parseFloat(bowlingSR.toFixed(2)),
                matches: Math.max(bat.batting_matches, bowl.bowling_matches),
                allrounder_score: parseFloat(allrounderScore.toFixed(2)),
            });
        }

        allrounders.sort((a, b) => b.allrounder_score - a.allrounder_score);
        res.json(allrounders.slice(0, parseInt(limit)));
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};
