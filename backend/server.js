/**
 * server.js — PitchIQ API Entry Point
 * 
 * Slim entry point that wires together middleware, database,
 * and route modules. All business logic lives in controllers/.
 */

const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');
const requestLogger = require('./middleware/requestLogger');
const routes = require('./routes');

const app = express();

// ── Core Middleware ──────────────────────────
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// ── Database Injection Middleware ────────────
// Injects `db` into every request so controllers
// can access it via `req.db` without module-level state.
let db;
app.use((req, res, next) => {
    req.db = db;
    next();
});

// ── API Routes ──────────────────────────────
app.use('/api', routes);

// ── Server Startup ──────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        db = await getDb();
        app.listen(PORT, () => {
            console.log(`PitchIQ API running on http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error('Failed to start server:', e.message);
        process.exit(1);
    }
}

startServer();