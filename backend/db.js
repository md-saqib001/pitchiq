/**
 * db.js — SQLite database wrapper using sql.js
 * 
 * Provides a better-sqlite3-compatible API on top of sql.js (WASM).
 * This means server.js doesn't need any changes — just swap the import.
 * 
 * Usage:
 *   const { getDb } = require('./db');
 *   const db = await getDb();
 *   const row = db.prepare('SELECT * FROM matches WHERE id = ?').get('335982');
 *   const rows = db.prepare('SELECT * FROM matches LIMIT 10').all();
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pitchiq.db');

let dbInstance = null;

/**
 * Creates a statement-like wrapper that mimics better-sqlite3's API
 */
function createStatement(db, sql) {
    return {
        /**
         * .get(...params) — returns a single row as an object, or undefined
         */
        get(...params) {
            try {
                const stmt = db.prepare(sql);
                stmt.bind(params.length > 0 ? params : undefined);
                if (stmt.step()) {
                    const columns = stmt.getColumnNames();
                    const values = stmt.get();
                    const row = {};
                    columns.forEach((col, i) => {
                        row[col] = values[i];
                    });
                    stmt.free();
                    return row;
                }
                stmt.free();
                return undefined;
            } catch (e) {
                console.error('SQL Error in .get():', e.message);
                console.error('Query:', sql);
                console.error('Params:', params);
                throw e;
            }
        },

        /**
         * .all(...params) — returns array of row objects
         */
        all(...params) {
            try {
                const stmt = db.prepare(sql);
                stmt.bind(params.length > 0 ? params : undefined);
                const results = [];
                const columns = stmt.getColumnNames();
                while (stmt.step()) {
                    const values = stmt.get();
                    const row = {};
                    columns.forEach((col, i) => {
                        row[col] = values[i];
                    });
                    results.push(row);
                }
                stmt.free();
                return results;
            } catch (e) {
                console.error('SQL Error in .all():', e.message);
                console.error('Query:', sql);
                console.error('Params:', params);
                throw e;
            }
        },

        /**
         * .run(...params) — execute and return { changes }
         */
        run(...params) {
            try {
                db.run(sql, params.length > 0 ? params : undefined);
                return { changes: db.getRowsModified() };
            } catch (e) {
                console.error('SQL Error in .run():', e.message);
                console.error('Query:', sql);
                throw e;
            }
        }
    };
}

/**
 * Wraps the sql.js database with better-sqlite3-compatible API
 */
function wrapDb(rawDb) {
    return {
        prepare(sql) {
            return createStatement(rawDb, sql);
        },
        exec(sql) {
            rawDb.run(sql);
        },
        pragma(pragma) {
            try {
                rawDb.run(`PRAGMA ${pragma}`);
            } catch (e) {
                // sql.js doesn't support all pragmas, silently ignore
            }
        },
        close() {
            rawDb.close();
        },
        // Expose raw db for advanced usage
        _raw: rawDb
    };
}

/**
 * Initialize and return the database instance (singleton)
 */
async function getDb() {
    if (dbInstance) return dbInstance;

    if (!fs.existsSync(DB_PATH)) {
        throw new Error(
            `Database file not found at ${DB_PATH}.\n` +
            `Run 'node etl.js' first to build the database from Cricsheet data.`
        );
    }

    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(DB_PATH);
    const rawDb = new SQL.Database(buffer);

    dbInstance = wrapDb(rawDb);

    // Verify the database has data
    const matchCount = dbInstance.prepare('SELECT COUNT(*) as cnt FROM matches').get();
    console.log(`Database loaded: ${matchCount.cnt} matches`);

    return dbInstance;
}

module.exports = { getDb, DB_PATH };
