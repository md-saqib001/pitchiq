const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '../data/data');
const DB_PATH = path.join(__dirname, 'pitchiq.db');

if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
}
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
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
        FOREIGN KEY(over_id) REFERENCES overs(id),
        FOREIGN KEY(innings_id) REFERENCES innings(id),
        FOREIGN KEY(match_id) REFERENCES matches(id)
    );
`);

const insertMatch = db.prepare(`
    INSERT INTO matches (id, date, venue, team1, team2, winner, toss_winner, toss_decision, dl_method, season, is_valid, invalid_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertInning = db.prepare(`
    INSERT INTO innings (id, match_id, innings_number, batting_team, bowling_team, total_runs, total_wickets, target, is_chase)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertOver = db.prepare(`
    INSERT INTO overs (id, innings_id, match_id, over_number, runs, wickets)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const insertDelivery = db.prepare(`
    INSERT INTO deliveries (id, over_id, innings_id, match_id, batter, bowler, non_striker, runs_batter, runs_extras, runs_total, extras_type, dismissal_kind, player_out, fielder, over_number, ball_number, match_phase)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function normalizeName(name) {
    if (!name) return name;
    let n = name.replace(/\\./g, ' ').replace(/\\s+/g, ' ').trim();
    if (n === 'Virat Kohli') n = 'V Kohli';
    return n;
}

function processMatchFiles() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    
    let stats = {
        matches: 0,
        innings: 0,
        overs: 0,
        deliveries: 0,
        dirtyRows: 0
    };

    const runTransaction = db.transaction((fileBatch) => {
        for (const file of fileBatch) {
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
            let venue = info.venue || 'Unknown';
            let team1 = info.teams && info.teams.length > 0 ? info.teams[0] : 'Unknown';
            let team2 = info.teams && info.teams.length > 1 ? info.teams[1] : 'Unknown';
            let tossWinner = info.toss && info.toss.winner ? info.toss.winner : null;
            let tossDecision = info.toss && info.toss.decision ? info.toss.decision : null;
            let season = info.season ? info.season.toString() : null;

            insertMatch.run(matchId, date, venue, team1, team2, winner, tossWinner, tossDecision, dlMethod, season, isValid, invalidReason);
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
                // PRECALCULATE total runs and wickets for this innings
                for (const overData of overs) {
                    const deliveries = overData.deliveries || [];
                    for (const del of deliveries) {
                        totalRuns += del.runs.total;
                        if (del.wickets && del.wickets.length > 0) {
                            totalWickets += 1;
                        }
                    }
                }

                // INNNINGS INSERT - MUST BE BEFORE OVERS AND DELIVERIES
                insertInning.run(inningsId, matchId, inningsNumber, battingTeam, bowlingTeam, totalRuns, totalWickets, target, isChase);
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

                    // OVERS INSERT - MUST BE BEFORE DELIVERIES
                    insertOver.run(overId, inningsId, matchId, overNumber, overRuns, overWickets);
                    stats.overs++;
                    
                    let ballNum = 1;
                    
                    for (const del of deliveries) {
                        const batter = normalizeName(del.batter);
                        const bowler = normalizeName(del.bowler);
                        const non_striker = normalizeName(del.non_striker);
                        const r_batter = del.runs.batter;
                        const r_extras = del.runs.extras;
                        const r_total = del.runs.total;

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

                        // DELIVERY INSERT
                        insertDelivery.run(
                            delId, overId, inningsId, matchId, 
                            batter, bowler, non_striker, 
                            r_batter, r_extras, r_total, 
                            extrasType, dismissalKind, playerOut, fielder, 
                            overNumber, ballNum, matchPhase
                        );

                        stats.deliveries++;
                        
                        if (!del.extras || (!del.extras.wides && !del.extras.noballs)) {
                            ballNum++;
                        } else {
                            ballNum++; 
                        }
                    }
                }
            }
        }
    });

    console.log('Running ETL...');
    runTransaction(files);
    console.log('ETL Processing Complete.');
    console.log("Total Matches: " + stats.matches);
    console.log("Total Innings: " + stats.innings);
    console.log("Total Overs: " + stats.overs);
    console.log("Total Deliveries: " + stats.deliveries);
    console.log("Dirty Rows flagged: " + stats.dirtyRows);
}

processMatchFiles();