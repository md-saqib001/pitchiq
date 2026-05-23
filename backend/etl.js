// backend/etl.js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 1. Initialize DB and enable Write-Ahead Logging for massive speed boosts
const db = new Database('pitchiq.db');
db.pragma('journal_mode = WAL');

console.log("Initializing database schema...");

// 2. Build the 4-table normalized schema
db.exec(`
  DROP TABLE IF EXISTS deliveries;
  DROP TABLE IF EXISTS overs;
  DROP TABLE IF EXISTS innings;
  DROP TABLE IF EXISTS matches;

  CREATE TABLE matches (
    match_id INTEGER PRIMARY KEY,
    date TEXT,
    venue TEXT,
    team1 TEXT,
    team2 TEXT,
    winner TEXT
  );

  CREATE TABLE innings (
    inning_id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER,
    inning_number INTEGER,
    batting_team TEXT,
    bowling_team TEXT,
    FOREIGN KEY(match_id) REFERENCES matches(match_id)
  );

  CREATE TABLE overs (
    over_id INTEGER PRIMARY KEY AUTOINCREMENT,
    inning_id INTEGER,
    over_number INTEGER,
    FOREIGN KEY(inning_id) REFERENCES innings(inning_id)
  );

  CREATE TABLE deliveries (
    delivery_id INTEGER PRIMARY KEY AUTOINCREMENT,
    over_id INTEGER,
    batter TEXT,
    bowler TEXT,
    runs_batter INTEGER,
    runs_extras INTEGER,
    extra_type TEXT,
    is_wicket INTEGER,
    dismissal_kind TEXT,
    fielder TEXT,
    FOREIGN KEY(over_id) REFERENCES overs(over_id)
  );
`);

// 3. Prepare SQL Statements (Compiled once, reused inside loops)
const insertMatch = db.prepare(`
  INSERT INTO matches (match_id, date, venue, team1, team2, winner) 
  VALUES (@match_id, @date, @venue, @team1, @team2, @winner)
`);

const insertInning = db.prepare(`
  INSERT INTO innings (match_id, inning_number, batting_team, bowling_team) 
  VALUES (@match_id, @inning_number, @batting_team, @bowling_team)
`);

const insertOver = db.prepare(`
  INSERT INTO overs (inning_id, over_number) 
  VALUES (@inning_id, @over_number)
`);

const insertDelivery = db.prepare(`
  INSERT INTO deliveries (over_id, batter, bowler, runs_batter, runs_extras, extra_type, is_wicket, dismissal_kind, fielder) 
  VALUES (@over_id, @batter, @bowler, @runs_batter, @runs_extras, @extra_type, @is_wicket, @dismissal_kind, @fielder)
`);

// 4. Set target folder path to the nested json location
const dataDir = path.join(__dirname, '..', 'data', 'data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

// 5. Run everything inside a high-speed SQLite transaction block
const processAllFiles = db.transaction(() => {
  let totalDeliveries = 0;

  files.forEach(file => {
    const matchId = parseInt(file.split('.')[0]);
    const rawData = fs.readFileSync(path.join(dataDir, file));
    const matchJson = JSON.parse(rawData);

    // Insert Match
    const info = matchJson.info;
    const date = info.dates ? info.dates[0] : 'Unknown';
    const venue = info.venue || 'Unknown';
    const team1 = info.teams ? info.teams[0] : 'Unknown';
    const team2 = info.teams ? info.teams[1] : 'Unknown';
    const winner = info.outcome?.winner || (info.outcome?.result || 'Tie/No Result');
    
    insertMatch.run({ match_id: matchId, date, venue, team1, team2, winner });

    // Loop Innings
    if (!matchJson.innings) return;
    
    matchJson.innings.forEach((inningObj, index) => {
      const inningNumber = index + 1;
      const battingTeam = inningObj.team;
      const bowlingTeam = battingTeam === team1 ? team2 : team1;

      const inningResult = insertInning.run({
        match_id: matchId,
        inning_number: inningNumber,
        batting_team: battingTeam,
        bowling_team: bowlingTeam
      });
      const inningId = inningResult.lastInsertRowid;

      // Loop Overs
      if (!inningObj.overs) return;
      inningObj.overs.forEach(overObj => {
        const overNumber = overObj.over;
        
        const overResult = insertOver.run({
          inning_id: inningId,
          over_number: overNumber
        });
        const overId = overResult.lastInsertRowid;

        // Loop Deliveries
        overObj.deliveries.forEach(ball => {
          totalDeliveries++;
          
          // Handle extras (extract type if it exists)
          let extraType = null;
          if (ball.extras) {
            extraType = Object.keys(ball.extras)[0]; // e.g., 'wides', 'legbyes'
          }

          // Handle wickets and fielders (dirty data handling)
          let isWicket = 0;
          let dismissalKind = null;
          let fielder = null;
          
          if (ball.wickets && ball.wickets.length > 0) {
            isWicket = 1;
            dismissalKind = ball.wickets[0].kind;
            if (ball.wickets[0].fielders && ball.wickets[0].fielders.length > 0) {
              fielder = ball.wickets[0].fielders[0].name;
            }
          }

          insertDelivery.run({
            over_id: overId,
            batter: ball.batter,
            bowler: ball.bowler,
            runs_batter: ball.runs.batter,
            runs_extras: ball.runs.extras,
            extra_type: extraType,
            is_wicket: isWicket,
            dismissal_kind: dismissalKind,
            fielder: fielder
          });
        });
      });
    });
  });
  
  return totalDeliveries;
});

// 6. Execute the script and monitor execution time metrics
console.log(`Found ${files.length} match files. Beginning ETL process...`);
console.time("ETL Ingestion Time");
const finalCount = processAllFiles();
console.timeEnd("ETL Ingestion Time");
console.log(`Successfully ingested ${finalCount} total deliveries.`);