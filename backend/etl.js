const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// ─────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '../data/data');
const DB_PATH = path.join(__dirname, 'pitchiq.db');
const PLAYER_MAP_PATH = path.join(__dirname, '../data/player_canonical_map.json');
const VENUE_MAP_PATH = path.join(__dirname, '../data/venue_canonical_map.json');

// ─────────────────────────────────────────────────────────
// Load cleaning maps from notebook output
// ─────────────────────────────────────────────────────────
let playerMap = {};
let venueMap = {};

if (fs.existsSync(PLAYER_MAP_PATH)) {
    playerMap = JSON.parse(fs.readFileSync(PLAYER_MAP_PATH, 'utf-8'));
    console.log(`Loaded player canonical map: ${Object.keys(playerMap).length} entries`);
} else {
    console.warn('WARNING: player_canonical_map.json not found - skipping player normalization');
}

if (fs.existsSync(VENUE_MAP_PATH)) {
    venueMap = JSON.parse(fs.readFileSync(VENUE_MAP_PATH, 'utf-8'));
    console.log(`Loaded venue canonical map: ${Object.keys(venueMap).length} entries`);
} else {
    console.warn('WARNING: venue_canonical_map.json not found - skipping venue normalization');
}

// ─────────────────────────────────────────────────────────
// Name normalization using cleaned maps
// ─────────────────────────────────────────────────────────
function normalizeName(name) {
    if (!name) return name;
    if (playerMap[name]) return playerMap[name];
    return name.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeVenue(venue) {
    if (!venue) return venue;
    if (venueMap[venue]) return venueMap[venue];
    return venue;
}

// ─────────────────────────────────────────────────────────
// Main ETL
// ─────────────────────────────────────────────────────────
async function main() {
    // Delete existing DB
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
        console.log('Deleted existing database');
    }

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Create tables
    db.run(`
        CREATE TABLE matches (
            id TEXT PRIMARY KEY,
            date TEXT,
            venue TEXT,
            team1 TEXT,
            team2 TEXT,
            winner TEXT,
            toss_winner TEXT,
            toss_decision TEXT,
            dl_method INTEGER,
            season TEXT,
            is_valid INTEGER DEFAULT 1,
            invalid_reason TEXT
        );

        CREATE TABLE innings (
            id TEXT PRIMARY KEY,
            match_id TEXT,
            innings_number INTEGER,
            batting_team TEXT,
            bowling_team TEXT,
            total_runs INTEGER,
            total_wickets INTEGER,
            target INTEGER,
            is_chase INTEGER,
            FOREIGN KEY(match_id) REFERENCES matches(id)
        );

        CREATE TABLE overs (
            id TEXT PRIMARY KEY,
            innings_id TEXT,
            match_id TEXT,
            over_number INTEGER,
            runs INTEGER,
            wickets INTEGER,
            FOREIGN KEY(innings_id) REFERENCES innings(id),
            FOREIGN KEY(match_id) REFERENCES matches(id)
        );

        CREATE TABLE deliveries (
            id TEXT PRIMARY KEY,
            over_id TEXT,
            innings_id TEXT,
            match_id TEXT,
            batter TEXT,
            bowler TEXT,
            non_striker TEXT,
            runs_batter INTEGER,
            runs_extras INTEGER,
            runs_total INTEGER,
            extras_type TEXT,
            dismissal_kind TEXT,
            player_out TEXT,
            fielder TEXT,
            over_number INTEGER,
            ball_number INTEGER,
            match_phase TEXT,
            is_valid INTEGER DEFAULT 1,
            FOREIGN KEY(over_id) REFERENCES overs(id),
            FOREIGN KEY(innings_id) REFERENCES innings(id),
            FOREIGN KEY(match_id) REFERENCES matches(id)
        );
    `);

    // ─────────────────────────────────────────────────────────
    // Process files
    // ─────────────────────────────────────────────────────────
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} match files to process`);

    let stats = {
        matches: 0,
        innings: 0,
        overs: 0,
        deliveries: 0,
        dirtyRows: 0,
        venueNormalized: 0,
        playerNormalized: 0
    };

    console.log('\n════════════════════════════════════════');
    console.log('  PitchIQ ETL Pipeline');
    console.log('════════════════════════════════════════\n');

    const startTime = Date.now();

    // Wrap in transaction for performance
    db.run('BEGIN TRANSACTION');

    for (const file of files) {
        const matchId = file.replace('.json', '');
        const rawData = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
        let data;
        try {
            data = JSON.parse(rawData);
        } catch (e) {
            console.error("Invalid JSON in file: " + file);
            continue;
        }

        const info = data.info;
        let isValid = 1;
        let invalidReason = null;

        if (!info.dates || !info.venue || !info.teams || info.teams.length < 2) {
            isValid = 0;
            invalidReason = 'Missing critical info (dates, venue or teams)';
            stats.dirtyRows++;
        }

        let dlMethod = (info.outcome && info.outcome.method === 'D/L') ? 1 : 0;
        let winner = info.outcome && info.outcome.winner ? info.outcome.winner : (info.outcome && info.outcome.result === 'tie' ? 'Tie' : 'No Result');
        let date = info.dates && info.dates[0] ? info.dates[0] : null;

        let rawVenue = info.venue || 'Unknown';
        let venue = normalizeVenue(rawVenue);
        if (venue !== rawVenue) stats.venueNormalized++;

        let team1 = info.teams && info.teams.length > 0 ? info.teams[0] : 'Unknown';
        let team2 = info.teams && info.teams.length > 1 ? info.teams[1] : 'Unknown';
        let tossWinner = info.toss && info.toss.winner ? info.toss.winner : null;
        let tossDecision = info.toss && info.toss.decision ? info.toss.decision : null;
        let season = info.season ? info.season.toString() : null;

        db.run(
            `INSERT INTO matches (id, date, venue, team1, team2, winner, toss_winner, toss_decision, dl_method, season, is_valid, invalid_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [matchId, date, venue, team1, team2, winner, tossWinner, tossDecision, dlMethod, season, isValid, invalidReason]
        );
        stats.matches++;

        if (isValid === 0) {
            console.log("Flagged dirty match:", matchId, invalidReason);
            continue;
        }

        const innings = data.innings || [];

        for (let i = 0; i < innings.length; i++) {
            const inningData = innings[i];
            const inningsNumber = i + 1;
            const battingTeam = inningData.team;
            const bowlingTeam = battingTeam === team1 ? team2 : team1;
            const inningsId = matchId + "_" + inningsNumber;

            let target = null;
            let isChase = 0;
            if (inningsNumber > 1 && inningData.target && inningData.target.runs) {
                target = inningData.target.runs;
                isChase = 1;
            } else if (inningsNumber > 1) {
                isChase = 1;
            }

            let totalRuns = 0;
            let totalWickets = 0;

            const overs = inningData.overs || [];
            for (const overData of overs) {
                const deliveries = overData.deliveries || [];
                for (const del of deliveries) {
                    totalRuns += del.runs.total;
                    if (del.wickets && del.wickets.length > 0) {
                        totalWickets += 1;
                    }
                }
            }

            db.run(
                `INSERT INTO innings (id, match_id, innings_number, batting_team, bowling_team, total_runs, total_wickets, target, is_chase) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [inningsId, matchId, inningsNumber, battingTeam, bowlingTeam, totalRuns, totalWickets, target, isChase]
            );
            stats.innings++;

            for (const overData of overs) {
                const overNumber = overData.over;
                const overId = inningsId + "_" + overNumber;
                let overRuns = 0;
                let overWickets = 0;

                const deliveries = overData.deliveries || [];
                for (const del of deliveries) {
                    overRuns += del.runs.total;
                    if (del.wickets && del.wickets.length > 0) {
                        overWickets += 1;
                    }
                }

                db.run(
                    `INSERT INTO overs (id, innings_id, match_id, over_number, runs, wickets) VALUES (?, ?, ?, ?, ?, ?)`,
                    [overId, inningsId, matchId, overNumber, overRuns, overWickets]
                );
                stats.overs++;

                let ballNum = 1;

                for (const del of deliveries) {
                    const batter = normalizeName(del.batter);
                    const bowler = normalizeName(del.bowler);
                    const non_striker = normalizeName(del.non_striker);
                    const r_batter = del.runs.batter;
                    const r_extras = del.runs.extras;
                    const r_total = del.runs.total;

                    if (batter !== del.batter || bowler !== del.bowler) {
                        stats.playerNormalized++;
                    }

                    let extrasType = null;
                    if (del.extras) {
                        extrasType = Object.keys(del.extras).join(',');
                    }

                    let dismissalKind = null;
                    let playerOut = null;
                    let fielder = null;

                    if (del.wickets && del.wickets.length > 0) {
                        const w = del.wickets[0];
                        dismissalKind = w.kind;
                        playerOut = normalizeName(w.player_out);
                        if (w.fielders && w.fielders.length > 0) {
                            fielder = normalizeName(w.fielders[0].name);
                        }
                    }

                    let matchPhase = 'middle';
                    if (overNumber <= 5) matchPhase = 'powerplay';
                    else if (overNumber >= 15) matchPhase = 'death';

                    const delId = overId + "_" + ballNum;
                    let delValid = 1;
                    if (r_batter < 0 || r_total < 0) delValid = 0;

                    db.run(
                        `INSERT INTO deliveries (id, over_id, innings_id, match_id, batter, bowler, non_striker, runs_batter, runs_extras, runs_total, extras_type, dismissal_kind, player_out, fielder, over_number, ball_number, match_phase, is_valid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [delId, overId, inningsId, matchId, batter, bowler, non_striker, r_batter, r_extras, r_total, extrasType, dismissalKind, playerOut, fielder, overNumber, ballNum, matchPhase, delValid]
                    );

                    stats.deliveries++;
                    ballNum++;
                }
            }
        }

        // Progress indicator every 100 matches
        if (stats.matches % 100 === 0) {
            process.stdout.write(`  Processed ${stats.matches}/${files.length} matches...\r`);
        }
    }

    db.run('COMMIT');

    // ─────────────────────────────────────────────────────────
    // Create indexes
    // ─────────────────────────────────────────────────────────
    console.log('\nCreating indexes...');
    db.run(`CREATE INDEX IF NOT EXISTS idx_del_batter ON deliveries(batter);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_del_batter_phase ON deliveries(batter, match_phase);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_del_batter_match ON deliveries(batter, match_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_del_bowler ON deliveries(bowler, match_phase);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_del_match ON deliveries(match_id, over_number);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_del_innings ON deliveries(innings_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_del_over ON deliveries(over_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_match_venue ON matches(venue);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_match_season ON matches(season);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_match_date ON matches(date);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_innings_chase ON innings(is_chase, target);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_innings_match ON innings(match_id, innings_number);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_overs_innings ON overs(innings_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_overs_match ON overs(match_id);`);
    db.run(`ANALYZE;`);
    console.log('Indexes created.\n');

    // ─────────────────────────────────────────────────────────
    // Save to disk
    // ─────────────────────────────────────────────────────────
    const data_out = db.export();
    const buffer = Buffer.from(data_out);
    fs.writeFileSync(DB_PATH, buffer);
    db.close();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const dbSize = (fs.statSync(DB_PATH).size / (1024 * 1024)).toFixed(1);

    console.log('ETL Processing Complete in ' + elapsed + 's');
    console.log('────────────────────────────────────────');
    console.log("  Matches loaded:        " + stats.matches);
    console.log("  Innings loaded:        " + stats.innings);
    console.log("  Overs loaded:          " + stats.overs);
    console.log("  Deliveries loaded:     " + stats.deliveries);
    console.log("  Dirty rows flagged:    " + stats.dirtyRows);
    console.log("  Venues normalized:     " + stats.venueNormalized);
    console.log("  Player names cleaned:  " + stats.playerNormalized);
    console.log('────────────────────────────────────────');
    console.log("  Database: " + DB_PATH + " (" + dbSize + " MB)");
    console.log('════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('ETL failed:', e);
    process.exit(1);
});