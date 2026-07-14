// backend/index.js — Create performance indexes for PitchIQ
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pitchiq.db');
const db = new Database(DB_PATH);

console.log('\n════════════════════════════════════════');
console.log('  PitchIQ Index Builder');
console.log('════════════════════════════════════════\n');

console.time('Indexing Time');

// Core delivery lookup indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_del_batter ON deliveries(batter);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_del_batter_phase ON deliveries(batter, match_phase);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_del_batter_match ON deliveries(batter, match_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_del_bowler ON deliveries(bowler, match_phase);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_del_match ON deliveries(match_id, over_number);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_del_innings ON deliveries(innings_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_del_over ON deliveries(over_id);`);

// Match lookup indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_match_venue ON matches(venue);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_match_season ON matches(season);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_match_date ON matches(date);`);

// Innings lookup indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_innings_chase ON innings(is_chase, target);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_innings_match ON innings(match_id, innings_number);`);

// Over lookup indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_overs_innings ON overs(innings_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_overs_match ON overs(match_id);`);

console.timeEnd('Indexing Time');

// Run ANALYZE so query planner optimizes based on indexes
db.exec(`ANALYZE;`);

console.log('All indexes created and ANALYZE complete.');
console.log('════════════════════════════════════════\n');

db.close();