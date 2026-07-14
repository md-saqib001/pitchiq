/**
 * controllers/matchController.js — Match data, scorecards, momentum, and matchups
 */

const { getDbSeason } = require('../utils/helpers');

// ──────────────────────────────────────────────
// GET /api/matchup
// ──────────────────────────────────────────────
exports.getMatchup = (req, res) => {
    try {
        const db = req.db;
        const { batter, bowler } = req.query;
        if (!batter || !bowler) {
            return res.status(400).json({ error: "Both batter and bowler are required" });
        }

        const query = `
            SELECT 
                SUM(d.runs_batter) as total_runs,
                COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as balls_faced,
                COUNT(CASE WHEN d.dismissal_kind IS NOT NULL THEN 1 END) as dismissals,
                SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
                SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
                SUM(CASE WHEN d.runs_batter = 0 AND d.extras_type IS NULL THEN 1 ELSE 0 END) as dots
            FROM deliveries d
            WHERE d.batter = ? AND d.bowler = ?
        `;
        const stats = db.prepare(query).get(batter, bowler);

        stats.strike_rate = stats.balls_faced > 0 ? ((stats.total_runs / stats.balls_faced) * 100).toFixed(2) : 0;
        stats.average = stats.dismissals > 0 ? (stats.total_runs / stats.dismissals).toFixed(2) : stats.total_runs;

        res.json(stats);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/momentum/:matchId
// ──────────────────────────────────────────────
exports.getMomentum = (req, res) => {
    try {
        const db = req.db;
        const matchId = req.params.matchId;
        const overs = db.prepare(`
            SELECT 
                o.id, o.over_number, i.innings_number,
                o.runs as runs_this_over, o.wickets as wickets_this_over, i.target,
                (SELECT SUM(o2.runs) FROM overs o2 WHERE o2.innings_id = i.id AND o2.over_number < o.over_number) as runs_before_over,
                (SELECT COUNT(CASE WHEN d.runs_batter IN (4, 6) THEN 1 END) * 1.0 / NULLIF(COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END), 0) FROM deliveries d WHERE d.over_id = o.id) as boundary_rate
            FROM overs o
            JOIN innings i ON o.innings_id = i.id
            WHERE o.match_id = ?
            ORDER BY i.innings_number, o.over_number
        `).all(matchId);

        let momentumScore = [];
        for (const over of overs) {
            const boundaryRate = over.boundary_rate || 0;
            const wPressure = over.wickets_this_over * -2.0;

            const runsScoredSoFar = over.runs_before_over || 0;
            const target = over.target || 160;
            const remainingRuns = target - runsScoredSoFar;
            const remainingOvers = 20 - over.over_number;

            let reqRunRate = remainingOvers > 0 ? (remainingRuns / remainingOvers) : 0;
            if (reqRunRate < 0) reqRunRate = 0;

            const rrDelta = over.runs_this_over - reqRunRate;
            const score = (rrDelta * 0.4) + (wPressure * 0.35) + (boundaryRate * 0.25);

            momentumScore.push({
                innings_number: over.innings_number,
                over_number: over.over_number,
                momentum: score.toFixed(2),
                runs_this_over: over.runs_this_over,
                wickets_this_over: over.wickets_this_over,
                rr_delta: rrDelta.toFixed(2)
            });
        }
        res.json({ match_id: matchId, momentum: momentumScore });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/matches
// ──────────────────────────────────────────────
exports.getMatches = (req, res) => {
    try {
        const db = req.db;
        const { venue, team, season: rawSeason, player, q, sort = 'date_desc', page = 1, limit = 20 } = req.query;
        const season = getDbSeason(rawSeason);

        let whereClause = '';
        let params = [];

        if (season && season !== 'all') {
            whereClause += ` AND m.season = ?`;
            params.push(season);
        }
        if (team && team !== 'all') {
            whereClause += ` AND (m.team1 = ? OR m.team2 = ?)`;
            params.push(team, team);
        }
        if (venue && venue !== 'all') {
            whereClause += ` AND m.venue LIKE ?`;
            params.push(`%${venue}%`);
        }
        if (player) {
            whereClause += ` AND m.id IN (SELECT DISTINCT match_id FROM deliveries WHERE batter LIKE ? OR bowler LIKE ?)`;
            params.push(`%${player}%`, `%${player}%`);
        }
        if (q) {
            whereClause += ` AND (m.team1 LIKE ? OR m.team2 LIKE ? OR m.venue LIKE ? OR m.season LIKE ? OR m.id IN (SELECT DISTINCT match_id FROM deliveries WHERE batter LIKE ? OR bowler LIKE ?))`;
            const searchParam = `%${q}%`;
            params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
        }

        // Count query
        const countQuery = `
            SELECT COUNT(DISTINCT m.id) as count
            FROM matches m
            JOIN innings i1 ON i1.match_id = m.id AND i1.innings_number = 1
            JOIN innings i2 ON i2.match_id = m.id AND i2.innings_number = 2
            WHERE 1=1
        ` + whereClause;

        const totalCount = db.prepare(countQuery).get(...params).count;

        // Selection query
        let selectQuery = `
            SELECT 
                m.id, m.date, m.venue, m.season, m.team1, m.team2, m.winner,
                i1.id as i1_id, i1.batting_team as team1_batting, i1.total_runs as team1_runs, i1.total_wickets as team1_wickets,
                i2.id as i2_id, i2.batting_team as team2_batting, i2.total_runs as team2_runs, i2.total_wickets as team2_wickets
            FROM matches m
            JOIN innings i1 ON i1.match_id = m.id AND i1.innings_number = 1
            JOIN innings i2 ON i2.match_id = m.id AND i2.innings_number = 2
            WHERE 1=1
        ` + whereClause;

        if (sort === 'date_asc') {
            selectQuery += ` ORDER BY m.date ASC`;
        } else {
            selectQuery += ` ORDER BY m.date DESC`;
        }

        selectQuery += ` LIMIT ? OFFSET ?`;
        const selectParams = [...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)];

        const matchesList = db.prepare(selectQuery).all(...selectParams);

        // Fetch balls bowled per innings to format overs
        const formattedMatches = matchesList.map(m => {
            const t1_balls = db.prepare("SELECT COUNT(*) as cnt FROM deliveries WHERE match_id = ? AND innings_id = ? AND (extras_type IS NULL OR (extras_type NOT LIKE '%wides%' AND extras_type NOT LIKE '%noballs%'))").get(m.id, m.i1_id).cnt;
            const t2_balls = db.prepare("SELECT COUNT(*) as cnt FROM deliveries WHERE match_id = ? AND innings_id = ? AND (extras_type IS NULL OR (extras_type NOT LIKE '%wides%' AND extras_type NOT LIKE '%noballs%'))").get(m.id, m.i2_id).cnt;

            return {
                id: m.id,
                date: m.date,
                venue: m.venue,
                season: m.season,
                team1: m.team1,
                team2: m.team2,
                winner: m.winner,
                team1_batting: m.team1_batting,
                team1_runs: m.team1_runs,
                team1_wickets: m.team1_wickets,
                team1_overs: `${Math.floor(t1_balls/6)}.${t1_balls%6}`,
                team2_batting: m.team2_batting,
                team2_runs: m.team2_runs,
                team2_wickets: m.team2_wickets,
                team2_overs: `${Math.floor(t2_balls/6)}.${t2_balls%6}`
            };
        });

        res.json({
            matches: formattedMatches,
            totalMatches: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/match/:matchId
// ──────────────────────────────────────────────
exports.getMatchById = (req, res) => {
    try {
        const db = req.db;
        const matchId = req.params.matchId;
        const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
        if (!match) {
            return res.status(404).json({ error: "Match not found" });
        }
        res.json(match);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/match/:matchId/scorecard
// ──────────────────────────────────────────────
exports.getScorecard = (req, res) => {
    try {
        const db = req.db;
        const matchId = req.params.matchId;
        const inningsList = db.prepare('SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number').all(matchId);

        const scorecard = [];
        for (const inn of inningsList) {
            // Batting scorecard
            const batting = db.prepare(`
                SELECT 
                    d.batter as name,
                    SUM(d.runs_batter) as runs,
                    COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as balls,
                    SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
                    SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
                    (SELECT dismissal_kind FROM deliveries WHERE match_id = d.match_id AND innings_id = d.innings_id AND player_out = d.batter LIMIT 1) as dismissal_kind,
                    (SELECT bowler FROM deliveries WHERE match_id = d.match_id AND innings_id = d.innings_id AND player_out = d.batter LIMIT 1) as dismissal_bowler,
                    (SELECT fielder FROM deliveries WHERE match_id = d.match_id AND innings_id = d.innings_id AND player_out = d.batter LIMIT 1) as dismissal_fielder
                FROM deliveries d
                WHERE d.match_id = ? AND d.innings_id = ?
                GROUP BY d.batter
                ORDER BY MIN(d.over_number * 100 + d.ball_number) ASC
            `).all(matchId, inn.id);

            // Bowling scorecard
            const bowlingRaw = db.prepare(`
                SELECT 
                    d.bowler as name,
                    COUNT(CASE WHEN d.extras_type IS NULL OR (d.extras_type NOT LIKE '%wides%' AND d.extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls,
                    SUM(d.runs_total) as runs_conceded,
                    COUNT(CASE WHEN d.dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                    SUM(CASE WHEN d.runs_total = 0 AND d.extras_type IS NULL THEN 1 ELSE 0 END) as dot_balls
                FROM deliveries d
                WHERE d.match_id = ? AND d.innings_id = ?
                GROUP BY d.bowler
                ORDER BY MIN(d.over_number * 100 + d.ball_number) ASC
            `).all(matchId, inn.id);

            const bowling = bowlingRaw.map(b => {
                const oversInteger = Math.floor(b.legal_balls / 6);
                const oversFraction = b.legal_balls % 6;
                const economy = b.legal_balls > 0 ? parseFloat(((b.runs_conceded / b.legal_balls) * 6).toFixed(2)) : 0;
                return {
                    name: b.name,
                    overs: `${oversInteger}.${oversFraction}`,
                    legal_balls: b.legal_balls,
                    runs_conceded: b.runs_conceded,
                    wickets: b.wickets,
                    dot_balls: b.dot_balls,
                    economy
                };
            });

            // Extras
            const extras = db.prepare(`
                SELECT 
                    SUM(runs_extras) as total_extras,
                    SUM(CASE WHEN extras_type LIKE '%wides%' THEN runs_extras ELSE 0 END) as wides,
                    SUM(CASE WHEN extras_type LIKE '%noballs%' THEN runs_extras ELSE 0 END) as noballs,
                    SUM(CASE WHEN extras_type LIKE '%byes%' AND extras_type NOT LIKE '%legbyes%' THEN runs_extras ELSE 0 END) as byes,
                    SUM(CASE WHEN extras_type LIKE '%legbyes%' THEN runs_extras ELSE 0 END) as legbyes
                FROM deliveries
                WHERE match_id = ? AND innings_id = ?
            `).get(matchId, inn.id);

            // Fall of Wickets
            const fow = db.prepare(`
                SELECT 
                    d.over_number,
                    d.ball_number,
                    d.player_out,
                    (SELECT SUM(runs_total) FROM deliveries d2 WHERE d2.match_id = d.match_id AND d2.innings_id = d.innings_id AND (d2.over_number < d.over_number OR (d2.over_number = d.over_number AND d2.ball_number <= d.ball_number))) as runs_at_wicket
                FROM deliveries d
                WHERE d.match_id = ? AND d.innings_id = ? AND d.dismissal_kind IS NOT NULL AND d.dismissal_kind NOT IN ('retired hurt', 'obstructing the field')
                ORDER BY d.over_number ASC, d.ball_number ASC
            `).all(matchId, inn.id);

            scorecard.push({
                innings_number: inn.innings_number,
                batting_team: inn.batting_team,
                bowling_team: inn.bowling_team,
                total_runs: inn.total_runs,
                total_wickets: inn.total_wickets,
                target: inn.target,
                batting,
                bowling,
                extras: extras || { total_extras: 0, wides: 0, noballs: 0, byes: 0, legbyes: 0 },
                fow
            });
        }
        res.json(scorecard);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// ──────────────────────────────────────────────
// GET /api/match/:matchId/player/:playerName
// ──────────────────────────────────────────────
exports.getPlayerMatchPerformance = (req, res) => {
    try {
        const db = req.db;
        const { matchId, playerName } = req.params;

        // Batting performance in this match
        const battingStats = db.prepare(`
            SELECT 
                SUM(runs_batter) as runs,
                COUNT(CASE WHEN extras_type IS NULL OR (extras_type NOT LIKE '%wides%' AND extras_type NOT LIKE '%noballs%') THEN 1 END) as balls,
                SUM(CASE WHEN runs_batter = 4 THEN 1 ELSE 0 END) as fours,
                SUM(CASE WHEN runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
                MAX(dismissal_kind) as dismissal_kind,
                MAX(bowler) as dismissal_bowler,
                MAX(fielder) as dismissal_fielder,
                (SELECT COUNT(*) FROM deliveries WHERE match_id = ? AND player_out = ?) as is_out
            FROM deliveries
            WHERE match_id = ? AND batter = ?
        `).get(matchId, playerName, matchId, playerName);

        let batting = null;
        if (battingStats && (battingStats.balls > 0 || battingStats.runs > 0)) {
            batting = {
                runs: battingStats.runs || 0,
                balls: battingStats.balls || 0,
                fours: battingStats.fours || 0,
                sixes: battingStats.sixes || 0,
                strike_rate: battingStats.balls > 0 ? parseFloat(((battingStats.runs / battingStats.balls) * 100).toFixed(2)) : 0,
                dismissal_kind: battingStats.is_out ? battingStats.dismissal_kind : null,
                dismissal_bowler: battingStats.is_out ? battingStats.dismissal_bowler : null,
                dismissal_fielder: battingStats.is_out ? battingStats.dismissal_fielder : null,
                is_out: !!battingStats.is_out
            };
        }

        // Bowling performance in this match
        const bowlingStats = db.prepare(`
            SELECT 
                COUNT(CASE WHEN extras_type IS NULL OR (extras_type NOT LIKE '%wides%' AND extras_type NOT LIKE '%noballs%') THEN 1 END) as legal_balls,
                SUM(runs_total) as runs_conceded,
                COUNT(CASE WHEN dismissal_kind IN ('bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket') THEN 1 END) as wickets,
                SUM(CASE WHEN runs_total = 0 AND extras_type IS NULL THEN 1 ELSE 0 END) as dot_balls
            FROM deliveries
            WHERE match_id = ? AND bowler = ?
        `).get(matchId, playerName);

        let bowling = null;
        if (bowlingStats && bowlingStats.legal_balls > 0) {
            const oversInteger = Math.floor(bowlingStats.legal_balls / 6);
            const oversFraction = bowlingStats.legal_balls % 6;
            bowling = {
                overs: `${oversInteger}.${oversFraction}`,
                runs_conceded: bowlingStats.runs_conceded || 0,
                wickets: bowlingStats.wickets || 0,
                dot_balls: bowlingStats.dot_balls || 0,
                economy: bowlingStats.legal_balls > 0 ? parseFloat(((bowlingStats.runs_conceded / bowlingStats.legal_balls) * 6).toFixed(2)) : 0
            };
        }

        // Timeline: faced balls (if they batted) or bowled balls (if they bowled)
        const battingTimeline = db.prepare(`
            SELECT 
                over_number,
                ball_number,
                bowler as opponent,
                runs_batter,
                runs_total,
                extras_type,
                dismissal_kind,
                player_out,
                fielder
            FROM deliveries
            WHERE match_id = ? AND batter = ?
            ORDER BY innings_id ASC, over_number ASC, ball_number ASC
        `).all(matchId, playerName);

        const bowlingTimeline = db.prepare(`
            SELECT 
                over_number,
                ball_number,
                batter as opponent,
                runs_batter,
                runs_total,
                extras_type,
                dismissal_kind,
                player_out,
                fielder
            FROM deliveries
            WHERE match_id = ? AND bowler = ?
            ORDER BY innings_id ASC, over_number ASC, ball_number ASC
        `).all(matchId, playerName);

        res.json({
            player: playerName,
            match_id: matchId,
            batting,
            bowling,
            battingTimeline,
            bowlingTimeline
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};
