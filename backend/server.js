// backend/server.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect to the fresh database we just populated
const db = new Database('pitchiq.db');

/**
 * Endpoint: Get Battery/Player Insights
 * Query Parameters: player, phase (all, powerplay, middle, death), role, context (chasing, defending)
 */
app.get('/api/analytics/player', (req, res) => {
    const { player, phase, context, opposition, venue, targetScore } = req.query;

    if (!player) {
        return res.status(400).json({ error: "Player name is required" });
    }

    try {
        console.time(`Query Time for ${player}`);

        // 1. Dynamic Parameter Binding Array
        const queryParams = [player];
        const conditions = ["d.batter = ?"];

        // 2. Phase Filters
        if (phase === 'powerplay') conditions.push("o.over_number BETWEEN 0 AND 5");
        else if (phase === 'middle') conditions.push("o.over_number BETWEEN 6 AND 14");
        else if (phase === 'death') conditions.push("o.over_number BETWEEN 15 AND 19");

        // 3. Context Filters
        if (context === 'chasing') conditions.push("i.inning_number = 2");
        else if (context === 'defending') conditions.push("i.inning_number = 1");

        // 4. Opposition & Venue Filters
        if (opposition) {
            conditions.push("i.bowling_team = ?");
            queryParams.push(opposition);
        }
        
        if (venue) {
            conditions.push("m.venue = ?");
            queryParams.push(venue);
        }

        // 5. Target Score Logic (Only applies if chasing)
        if (context === 'chasing' && targetScore) {
            conditions.push("fi.target >= ?");
            queryParams.push(parseInt(targetScore));
        }

        // 6. The CTE SQL Query
        const battingQuery = `
            WITH FirstInnings AS (
                SELECT i.match_id, SUM(d.runs_batter + d.runs_extras) as target
                FROM deliveries d
                JOIN overs o ON d.over_id = o.over_id
                JOIN innings i ON o.inning_id = i.inning_id
                WHERE i.inning_number = 1
                GROUP BY i.match_id
            )
            SELECT 
                COUNT(d.delivery_id) as balls_faced,
                SUM(d.runs_batter) as total_runs,
                SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
                SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
                SUM(d.is_wicket) as dismissals
            FROM deliveries d
            JOIN overs o ON d.over_id = o.over_id
            JOIN innings i ON o.inning_id = i.inning_id
            JOIN matches m ON i.match_id = m.match_id
            LEFT JOIN FirstInnings fi ON i.match_id = fi.match_id
            WHERE ${conditions.join(" AND ")}
        `;

        const stats = db.prepare(battingQuery).get(...queryParams);
        console.timeEnd(`Query Time for ${player}`);

        // 7. Calculate Frontend Metrics
        const balls = stats.balls_faced || 0;
        const runs = stats.total_runs || 0;
        const dismissals = stats.dismissals || 0;
        
        const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : "0.00";
        const average = dismissals > 0 ? (runs / dismissals).toFixed(2) : runs.toFixed(2);

        res.json({
            player,
            metrics: {
                runs,
                balls_faced: balls,
                strike_rate: parseFloat(strikeRate),
                average: parseFloat(average),
                fours: stats.fours,
                sixes: stats.sixes,
                dismissals
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal database query execution failure" });
    }
});


app.get('/api/analytics/bowler', (req, res) => {
    const { bowler, phase, venue } = req.query;

    if (!bowler) {
        return res.status(400).json({ error: "Bowler name is required" });
    }

    let phaseCondition = "";
    if (phase === 'powerplay') phaseCondition = "AND o.over_number BETWEEN 0 AND 5";
    else if (phase === 'middle') phaseCondition = "AND o.over_number BETWEEN 6 AND 14";
    else if (phase === 'death') phaseCondition = "AND o.over_number BETWEEN 15 AND 19";

    let venueCondition = "";
    // If the user selects a venue on the frontend, we add it to the SQL query
    if (venue) venueCondition = "AND m.venue = ?"; 

    try {
        // 1. Start the high-resolution console timer
        console.time(`Query Time for ${bowler}`);

        const bowlerQuery = `
            SELECT 
                COUNT(d.delivery_id) as balls_bowled,
                SUM(d.runs_batter + d.runs_extras) as runs_conceded,
                SUM(d.is_wicket) as wickets,
                SUM(CASE WHEN d.runs_batter = 0 AND d.runs_extras = 0 THEN 1 ELSE 0 END) as dot_balls
            FROM deliveries d
            JOIN overs o ON d.over_id = o.over_id
            JOIN innings i ON o.inning_id = i.inning_id
            JOIN matches m ON i.match_id = m.match_id
            WHERE d.bowler = ? 
            ${phaseCondition}
            ${venueCondition}
        `;

        const params = venue ? [bowler, venue] : [bowler];
        const stats = db.prepare(bowlerQuery).get(...params);

        // 2. Stop the timer immediately after the database drops the row
        console.timeEnd(`Query Time for ${bowler}`);

        const balls = stats.balls_bowled || 0;
        const runs = stats.runs_conceded || 0;
        const wickets = stats.wickets || 0;
        
        const oversBowled = balls / 6;
        const economyRate = oversBowled > 0 ? (runs / oversBowled).toFixed(2) : "0.00";
        const bowlingStrikeRate = wickets > 0 ? (balls / wickets).toFixed(2) : "0.00";

        res.json({
            bowler,
            metrics: {
                wickets,
                overs_bowled: oversBowled.toFixed(1),
                runs_conceded: runs,
                economy_rate: parseFloat(economyRate),
                bowling_strike_rate: parseFloat(bowlingStrikeRate),
                dot_balls: stats.dot_balls
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal database query execution failure" });
    }
});


app.get('/api/players/search', (req, res) => {
    const { q, role } = req.query;
    
    if (!q || q.trim().length < 2) {
        return res.json([]); // Don't query for a single letter to save performance
    }

    try {
        let sql = "";
        if (role === 'batter') {
            sql = `SELECT DISTINCT batter AS name FROM deliveries WHERE batter LIKE ? LIMIT 8`;
        } else {
            sql = `SELECT DISTINCT bowler AS name FROM deliveries WHERE bowler LIKE ? LIMIT 8`;
        }

        // Use standard wildcards: %query% matches if it appears anywhere in the name
        const searchPattern = `%${q}%`;
        const suggestions = db.prepare(sql).all(searchPattern);
        
        // Return a clean flat array of names
        res.json(suggestions.map(player => player.name));
    } catch (error) {
        console.error("Autocomplete failure:", error);
        res.status(500).json({ error: "Failed to fetch suggestions" });
    }
});

/**
 * Endpoint: Predictive Team Autocomplete (With Prefix Abbreviation Support)
 */
app.get('/api/teams/search', (req, res) => {
    let { q } = req.query;
    if (!q) return res.json([]);

    const searchKey = q.toLowerCase().trim();
    if (searchKey.length < 1) return res.json([]);

    const aliases = {
        "csk": "Chennai Super Kings",
        "rcb": "Royal Challengers Bangalore",
        "mi": "Mumbai Indians",
        "kkr": "Kolkata Knight Riders",
        "srh": "Sunrisers Hyderabad",
        "dc": "Delhi Capitals",
        "rr": "Rajasthan Royals",
        "pbks": "Punjab Kings",
        "lsg": "Lucknow Super Giants",
        "gt": "Gujarat Titans",
        "kxip": "Kings XI Punjab",
        "dd": "Delhi Daredevils"
    };

    // 1. Find any team whose abbreviation STARTS WITH the user's input (e.g., "k" -> "kkr" & "kxip")
    const matchedAliases = Object.entries(aliases)
        .filter(([abbr]) => abbr.startsWith(searchKey))
        .map(([_, fullName]) => fullName);

    try {
        // 2. Do the normal database search
        const sql = `SELECT DISTINCT bowling_team AS name FROM innings WHERE bowling_team LIKE ? LIMIT 8`;
        const dbSuggestions = db.prepare(sql).all(`%${searchKey}%`).map(team => team.name);

        // 3. Merge both lists and remove duplicates using a Set
        const combinedResults = [...new Set([...matchedAliases, ...dbSuggestions])];
        
        // 4. Return up to 8 results
        res.json(combinedResults.slice(0, 8));
    } catch (error) {
        console.error("Team autocomplete failure:", error);
        res.status(500).json({ error: "Failed to fetch teams" });
    }
});

/**
 * Endpoint: Predictive Venue Autocomplete
 */
app.get('/api/venues/search', (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    try {
        const sql = `SELECT DISTINCT venue AS name FROM matches WHERE venue LIKE ? LIMIT 8`;
        const suggestions = db.prepare(sql).all(`%${q}%`);
        res.json(suggestions.map(v => v.name));
    } catch (error) {
        console.error("Venue autocomplete failure:", error);
        res.status(500).json({ error: "Failed to fetch venues" });
    }
});

app.listen(PORT, () => {
    console.log(`PitchIQ Intelligence Core active on port ${PORT}`);
});