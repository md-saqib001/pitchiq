const Database = require('better-sqlite3');
const db = new Database('pitchiq.db');

console.log("Initiating Complete Venue Normalization...");

// The Master Mapping Dictionary
// It catches exact names, city suffixes, and historical name changes
const cleanups = [
    // 1. Mumbai Venues
    { target: 'Wankhede Stadium', pattern: '%Wankhede%' },
    { target: 'Brabourne Stadium', pattern: 'Brabourne Stadium%' },
    { target: 'Dr DY Patil Sports Academy', pattern: 'Dr DY Patil Sports Academy%' },
    
    // 2. Renamed & Suffix Venues (Merged into Modern Names)
    { target: 'Arun Jaitley Stadium', pattern: 'Arun Jaitley%' },
    { target: 'Arun Jaitley Stadium', pattern: 'Feroz Shah Kotla%' }, // Historical merge
    
    { target: 'Narendra Modi Stadium', pattern: 'Narendra Modi%' },
    { target: 'Narendra Modi Stadium', pattern: 'Sardar Patel Stadium, Motera%' }, // Historical merge
    
    { target: 'Maharashtra Cricket Association Stadium', pattern: 'Maharashtra Cricket Association Stadium%' },
    { target: 'Maharashtra Cricket Association Stadium', pattern: 'Subrata Roy Sahara Stadium%' }, // Historical merge

    { target: 'Sheikh Zayed Stadium', pattern: 'Sheikh Zayed Stadium%' },
    { target: 'Sheikh Zayed Stadium', pattern: 'Zayed Cricket Stadium%' }, 
    
    // 3. Standard City Suffix Removals
    { target: 'Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium', pattern: 'Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium%' },
    { target: 'Himachal Pradesh Cricket Association Stadium', pattern: 'Himachal Pradesh Cricket Association Stadium%' },
    { target: 'Maharaja Yadavindra Singh International Cricket Stadium', pattern: 'Maharaja Yadavindra Singh International Cricket Stadium%' },
    { target: 'Sawai Mansingh Stadium', pattern: 'Sawai Mansingh Stadium%' },
    { target: 'Shaheed Veer Narayan Singh International Stadium', pattern: 'Shaheed Veer Narayan Singh International Stadium%' },
    { target: 'Barsapara Cricket Stadium', pattern: 'Barsapara Cricket Stadium%' },
    { target: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium', pattern: '%Ekana%' },
    
    // 4. Safety Nets for the remaining majors
    { target: 'M Chinnaswamy Stadium', pattern: '%Chinnaswamy%' },
    { target: 'MA Chidambaram Stadium', pattern: '%Chidambaram%' },
    { target: 'Rajiv Gandhi International Stadium', pattern: '%Rajiv Gandhi%' },
    { target: 'Eden Gardens', pattern: '%Eden Gardens%' },
    { target: 'Punjab Cricket Association Stadium', pattern: '%Punjab Cricket Association%' }
];

const stmt = db.prepare(`UPDATE matches SET venue = ? WHERE venue LIKE ?`);

let totalChanges = 0;

// Run the script synchronously 
for (const rule of cleanups) {
    const info = stmt.run(rule.target, rule.pattern);
    if (info.changes > 0) {
        console.log(`Merged ${info.changes} historical/duplicate records into -> ${rule.target}`);
        totalChanges += info.changes;
    }
}

console.log(`\nSuccess: ${totalChanges} fragmented stadium records have been perfectly unified.`);