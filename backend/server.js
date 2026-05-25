const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'pitchiq.db');
const db = new Database(DB_PATH, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

const getDbSeason = (season) => {
    if (!season) return season;
    const mapping = {
        '2008': '2007/08',
        '2010': '2009/10',
        '2020': '2020/21'
    };
    return mapping[season] || season;
};

app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
});

// Endpoint: Single Player Batting Stats
app.get('/api/player/:name/stats', (req, res) => {
    try {
        const name = req.params.name;
        const { phase, venue, situation, target_min, target_max, season: rawSeason, opposition } = req.query;
        const season = getDbSeason(rawSeason);

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
        const params = [name];

        if (phase && phase !== 'all') {
            query += ` AND d.match_phase = ?`;
            params.push(phase);
        }
        if (venue) {
            query += ` AND m.venue LIKE ?`;
            params.push(`%${venue}%`);
        }
        if (situation === 'chase') {
            query += ` AND i.is_chase = 1`;
        } else if (situation === 'defend') {
            query += ` AND i.is_chase = 0`;
        }
        if (target_min) { query += ` AND i.target >= ?`; params.push(target_min); }
        if (target_max) { query += ` AND i.target <= ?`; params.push(target_max); }
        if (season) { query += ` AND m.season = ?`; params.push(season); }
        if (opposition) {
            query += ` AND ((m.team1 = ? AND i.batting_team = m.team2) OR (m.team2 = ? AND i.batting_team = m.team1))`;
            params.push(opposition, opposition);
        }

        const stats = db.prepare(query).get(...params);
        res.json({
           ...stats,
           dot_percentage: stats.balls_faced > 0 ? ((stats.dots / stats.balls_faced) * 100).toFixed(2) : 0
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint: Single Player Bowling Stats
app.get('/api/player/:name/bowling_stats', (req, res) => {
    try {
        const name = req.params.name;
        const { phase, venue, situation, target_min, target_max, season: rawSeason, opposition } = req.query;
        const season = getDbSeason(rawSeason);

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
        const params = [name];

        if (phase && phase !== 'all') { query += ` AND d.match_phase = ?`; params.push(phase); }
        if (venue) { query += ` AND m.venue LIKE ?`; params.push(`%${venue}%`); }
        if (situation === 'chase') {
            // Player's team is chasing, meaning they bowled first (is_chase = 0)
            query += ` AND i.is_chase = 0`;
        } else if (situation === 'defend') {
            // Player's team is defending, meaning they bowled second (is_chase = 1)
            query += ` AND i.is_chase = 1`;
        }
        if (target_min) { query += ` AND i.target >= ?`; params.push(target_min); }
        if (target_max) { query += ` AND i.target <= ?`; params.push(target_max); }
        if (season) { query += ` AND m.season = ?`; params.push(season); }
        if (opposition) {
            query += ` AND i.batting_team = ?`;
            params.push(opposition);
        }

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
});

// Endpoint: Head-to-Head Batter vs Bowler
app.get('/api/matchup', (req, res) => {
    try {
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
});

// Endpoint: Match Momentum
app.get('/api/momentum/:matchId', (req, res) => {
    try {
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
});

// Endpoint: Fetch Matches
app.get('/api/matches', (req, res) => {
    try {
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
});

// Endpoint: Match Metadata
app.get('/api/match/:matchId', (req, res) => {
    try {
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
});

// Endpoint: Match Scorecard (batting, bowling, extras, Fall of Wickets for both innings)
app.get('/api/match/:matchId/scorecard', (req, res) => {
    try {
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
});

// Endpoint: Player Match-Specific Performance Drawer Detail (including logs)
app.get('/api/match/:matchId/player/:playerName', (req, res) => {
    try {
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
});

// Endpoint: Top Run Scorers Leaderboard (Enhanced)
app.get('/api/leaderboard/batting', (req, res) => {
    try {
        const { season: rawSeason, limit = 25, phase, metric = 'total_runs', min_innings = 0 } = req.query;
        const season = getDbSeason(rawSeason);

        const validMetrics = ['total_runs', 'average', 'strike_rate', 'boundary_rate'];
        const orderBy = validMetrics.includes(metric) ? metric : 'total_runs';
        const orderDir = (orderBy === 'total_runs') ? 'DESC' : 'DESC';

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
});

// Endpoint: Top Wicket-Takers / Bowling Leaderboard
app.get('/api/leaderboard/bowling', (req, res) => {
    try {
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
});

// Endpoint: All-Rounder Leaderboard
// Formula: AR Score = Batting Impact + Bowling Impact
//   Batting Impact = (Batting Avg × Strike Rate) / 100
//   Bowling Impact = 10000 / (Economy × Bowling Strike Rate)
// Requires minimum runs AND wickets to qualify
app.get('/api/leaderboard/allrounder', (req, res) => {
    try {
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
});


// Endpoint: AI-like Query Parser
app.post('/api/ask', (req, res) => {
    try {
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
});

// Endpoint: Season Trend (sparkline data)
app.get('/api/player/:name/season_trend', (req, res) => {
    try {
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
                avg: d.avg ? parseFloat(d.avg.toFixed(2)) : 0,
                sr: d.sr ? parseFloat(d.sr.toFixed(2)) : 0,
                runs: d.runs || 0,
                boundary_rate: d.boundary_rate ? parseFloat(d.boundary_rate.toFixed(2)) : 0,
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
});

// Endpoint: IPL Averages (benchmark for comparison)
app.get('/api/ipl_averages', (req, res) => {
    try {
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
});

// Endpoint: Phase Breakdown (powerplay/middle/death split)
app.get('/api/player/:name/phase_breakdown', (req, res) => {
    try {
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
            d.avg = d.avg ? parseFloat(d.avg.toFixed(2)) : 0;
            d.sr = d.sr ? parseFloat(d.sr.toFixed(2)) : 0;
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint: Bowling Phase Breakdown
app.get('/api/player/:name/bowling_phase_breakdown', (req, res) => {
    try {
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
});

// Endpoint: Venue Stats (per-venue batting breakdown)
app.get('/api/player/:name/venue_stats', (req, res) => {
    try {
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
            d.avg = d.avg ? parseFloat(d.avg.toFixed(2)) : 0;
            d.sr = d.sr ? parseFloat(d.sr.toFixed(2)) : 0;
        });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint: Bowling Venue Stats
app.get('/api/player/:name/bowling_venue_stats', (req, res) => {
    try {
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
});

// Endpoint: Compare Stats (full stats for radar chart)
app.get('/api/player/:name/compare_stats', (req, res) => {
    try {
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
            avg: stats.avg ? parseFloat(stats.avg.toFixed(2)) : 0,
            sr: stats.sr ? parseFloat(stats.sr.toFixed(2)) : 0,
            runs: stats.runs || 0,
            boundary_rate: stats.boundary_rate ? parseFloat(stats.boundary_rate.toFixed(2)) : 0,
            matches: stats.matches || 0,
            innings: stats.innings || 0,
            powerplay_sr: ppSR && ppSR.sr ? parseFloat(ppSR.sr.toFixed(2)) : 0,
            death_sr: deathSR && deathSR.sr ? parseFloat(deathSR.sr.toFixed(2)) : 0,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint: Recent Innings (last 10 innings with match context)
app.get('/api/player/:name/recent_innings', (req, res) => {
    try {
        const name = req.params.name;
        // Get distinct innings this player batted in, ordered by date
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
});

// Endpoint: Bowling Recent Innings
app.get('/api/player/:name/bowling_recent_innings', (req, res) => {
    try {
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
});

// Endpoint: Resources
app.get('/api/venues', (req, res) => {
    try {
        res.json(db.prepare(`SELECT venue, COUNT(*) as match_count FROM matches GROUP BY venue ORDER BY match_count DESC`).all());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/teams', (req, res) => {
    try {
        res.json(db.prepare(`SELECT team, SUM(matches) as match_count FROM (SELECT team1 as team, COUNT(*) as matches FROM matches GROUP BY team1 UNION ALL SELECT team2 as team, COUNT(*) as matches FROM matches GROUP BY team2) GROUP BY team ORDER BY match_count DESC`).all());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/players', (req, res) => {
    try {
        res.json(db.prepare(`SELECT DISTINCT batter as name FROM deliveries ORDER BY batter ASC`).all().map(r => r.name));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/players/summary', (req, res) => {
    try {
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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});