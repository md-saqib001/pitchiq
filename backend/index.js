// backend/index.js
const Database = require('better-sqlite3');
const db = new Database('pitchiq.db');

console.log("Applying structural indexing optimization...");

console.time("Indexing Execution Time");

// 1. Create a composite index on the core delivery filter targets
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_deliveries_lookup 
  ON deliveries (batter, over_id);
`);

// 2. Create index on foreign key relationships to prevent slow JOIN lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_overs_lookup 
  ON overs (over_id, over_number, inning_id);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_innings_lookup 
  ON innings (inning_id, inning_number);
`);

console.timeEnd("Indexing Execution Time");
console.log("Indexes successfully built. Analyzing table data...");

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_deliveries_bowler_lookup 
  ON deliveries (bowler, over_id);
`);

// Run ANALYZE so the query planner optimizes paths based on the new indexes
db.exec(`ANALYZE;`);
console.log("Database optimized.");