# PitchIQ

**PitchIQ** is a highly advanced, full-stack cricket analytics platform built for T20 franchise cricket (e.g., the IPL). It processes ball-by-ball data spanning over 15 years to provide deep statistical insights, advanced player matchups, phase-by-phase breakdowns, venue intelligence, and a heuristic-based natural language query feature.

This repository demonstrates advanced architectural patterns (modular monoliths, adapter patterns), data engineering (ETL processes), RESTful API design, and a modern, high-performance frontend built with React and Tailwind CSS.

---

## 🏗️ System Architecture & Tech Stack

PitchIQ follows a robust three-tier architecture utilizing an embedded in-memory database to eliminate network latency for complex analytical queries.

1. **Database / Data Layer**: 
   - **SQLite via WebAssembly (`sql.js`)**: Runs an embedded SQLite database loaded directly into memory from a `.db` file. This is crucial for rapid analytical aggregations across hundreds of thousands of rows without the overhead of network calls to a separate DB server.
2. **Backend / API Layer**: 
   - **Node.js & Express.js**: Designed as a Modular Monolith. The backend handles HTTP routing, middleware execution (like custom request loggers), and exposes RESTful API endpoints.
   - **Adapter Pattern (`db.js`)**: We wrap `sql.js` (which uses a slightly different syntax) in a custom adapter that mimics the synchronous `better-sqlite3` API (`.prepare()`, `.get()`, `.all()`). This decouples the controllers from the underlying DB implementation.
3. **Frontend / Client Layer**: 
   - **React.js (Vite)**: Rapid HMR and optimized builds.
   - **Tailwind CSS**: Utility-first CSS framework for a premium, glassmorphism-inspired UI.
   - **Recharts**: Composable charting library for rendering radar charts, bar charts, line graphs, and pie charts.

### 🔄 The Request Lifecycle (Data Flow)
1. **User Interaction**: User interacts with a React component (e.g., `HeadToHead.jsx`).
2. **API Client**: Component calls a function in `frontend/src/utils/api.js` (an Axios instance).
3. **Express Router**: The request hits `server.js` and is routed via `routes/index.js` to the appropriate domain router (e.g., `routes/playerRoutes.js`).
4. **Controller Execution**: The domain router forwards the request to the specific controller (e.g., `playerController.js`).
5. **Database Query**: The controller extracts `req.db` (injected via middleware), prepares a parameterized SQL query, executes it synchronously against the in-memory SQLite DB, and returns the JSON payload.

---

## 📂 Complete Directory Structure

The repository is divided into two primary workspaces: `backend` and `frontend`, along with a `data` directory for raw datasets.

```text
pitchiq/
├── backend/                        # Node.js Express Server
│   ├── controllers/                # Business logic and database queries
│   │   ├── leaderboardController.js # Ranks players across various metrics
│   │   ├── matchController.js       # Handles match data, scorecards, and matchups
│   │   ├── metaController.js        # Handles NLP parser, team/venue lookups
│   │   └── playerController.js      # Handles individual player statistics
│   ├── middleware/                 # Express middlewares
│   │   └── requestLogger.js         # Logs API requests in development
│   ├── routes/                     # Express Router definitions
│   │   ├── index.js                 # Route aggregator
│   │   ├── leaderboardRoutes.js     # Routes for /api/leaderboard/*
│   │   ├── matchRoutes.js           # Routes for /api/match/*
│   │   ├── metaRoutes.js            # Routes for top-level meta endpoints
│   │   └── playerRoutes.js          # Routes for /api/player/*
│   ├── utils/                      # Helper functions
│   │   └── helpers.js               # Shared logic (e.g., filtering utilities)
│   ├── db.js                       # Adapter mimicking better-sqlite3 using sql.js
│   ├── etl.js                      # Data pipeline script (JSON to SQLite)
│   ├── pitchiq.db                  # The generated SQLite database file
│   ├── server.js                   # Slim application entry point
│   └── package.json
│
├── frontend/                       # React (Vite) Application
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── AskPitchIQ.jsx       # NLP Chat interface
│   │   │   ├── FilterBar.jsx        # Global data filters (season, venue, phase)
│   │   │   ├── HeadToHead.jsx       # Batter vs Bowler matchup dashboard
│   │   │   ├── PlayerCompare.jsx    # Radar chart for comparing two players
│   │   │   ├── MatchTimeline.jsx    # Visualizes match momentum
│   │   │   ├── PhaseBreakdown.jsx   # Pie charts for Powerplay/Middle/Death
│   │   │   ├── StatCard.jsx         # Highly reusable metric cards
│   │   │   └── TopPerformers.jsx    # Leaderboard tables
│   │   ├── pages/                  # Top-level route components
│   │   │   ├── Home.jsx             # Main dashboard
│   │   │   ├── MatchDetail.jsx      # Scorecard and match analytics
│   │   │   ├── Matches.jsx          # Historical match catalog
│   │   │   ├── PlayerProfile.jsx    # Deep dive into a specific player
│   │   │   └── TopPerformersPage.jsx# Full-screen leaderboards
│   │   ├── utils/
│   │   │   └── api.js               # Axios client for communicating with the backend
│   │   ├── App.jsx                 # Client-side routing and layout
│   │   ├── index.css               # Global Tailwind directives and custom CSS
│   │   └── main.jsx                # React DOM entry point
│   ├── tailwind.config.js          # Tailwind theme configurations
│   └── vite.config.js              # Vite bundler configurations
│
└── data/                           # Data Engineering Assets
    ├── data/                       # Raw Cricsheet JSON files (ball-by-ball data)
    ├── player_canonical_map.json   # Maps misspelled names to a single canonical ID
    └── venue_canonical_map.json    # Maps alternate venue names to a canonical ID
```

---

## 🔌 API Endpoints Reference

To help developers (and AI assistants) understand how to interact with the backend, here is the complete API map:

### 🏏 Player Endpoints (`/api/player/:name/*`)
- `GET /stats` - Core batting stats (Runs, Avg, SR, Boundaries)
- `GET /bowling_stats` - Core bowling stats (Wickets, Econ, SR, Avg)
- `GET /phase_breakdown` - Batting stats split by Powerplay, Middle, Death
- `GET /bowling_phase_breakdown` - Bowling stats split by match phase
- `GET /season_trend` - Year-over-year performance data
- `GET /venue_stats` - Performance across different stadiums
- `GET /compare_stats` - Specialized radar-chart normalization data
- `GET /recent_innings` - Data for the player's last 5-10 matches

### 🏟️ Match Endpoints (`/api/match/*` & `/api/matchup`)
- `GET /api/matches` - Paginated list of all historic matches
- `GET /api/match/:matchId` - Basic match metadata
- `GET /api/match/:matchId/scorecard` - Reconstructed full scorecard
- `GET /api/match/:matchId/player/:playerName` - A specific player's performance in a single game
- `GET /api/momentum/:matchId` - Over-by-over run rates for charting match flow
- `GET /api/matchup?batter=X&bowler=Y` - **Head-to-Head Engine**: Returns precise ball-by-ball interactions between a specific batter and bowler.

### 🏆 Leaderboard Endpoints (`/api/leaderboard/*`)
- `GET /batting` - Top run scorers
- `GET /bowling` - Top wicket takers
- `GET /allrounder` - Ranks players using the custom All-Rounder formula

### 🧠 Meta & NLP Endpoints (`/api/*`)
- `GET /venues`, `/teams`, `/players` - Lookups for UI dropdowns
- `GET /ipl_averages` - Global baseline averages (used for the Player Compare radar charts)
- `POST /ask` - **The NLP Engine**: Accepts a JSON body `{ "query": "Best batsman in powerplay at Wankhede" }`. Parses text heuristically to build dynamic SQL.

---

## 🧮 Key Algorithms & Formulas

To ensure statistical integrity, PitchIQ employs several custom algorithms in its SQL controllers:

1. **The All-Rounder Rating (`leaderboardController.js`)**:
   - `Batting Impact` = `(Batting Average × Strike Rate) / 100`
   - `Bowling Impact` = `10000 / (Economy × Bowling Strike Rate)`
   - `Total Score` = `Batting Impact + Bowling Impact`
   - *Requirement: Player must have minimum 500 runs AND 30 wickets.*

2. **Match Phases (`etl.js`)**:
   - Calculated during DB insertion: `Powerplay` (Overs 1-6), `Middle` (Overs 7-15), `Death` (Overs 16-20).

3. **Match Momentum (`matchController.js`)**:
   - Calculates the rolling run-rate by aggregating `runs_total` per over, divided by `(legal_balls / 6)`.

---

## 🗄️ Database Schema & Design

The database `pitchiq.db` uses a highly optimized, normalized relational schema containing over 1,200 matches. Using standard relational design ensures data integrity and allows for complex aggregations. Below is the exact `CREATE TABLE` schema used in the ETL pipeline.

```sql
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
```

---

## 🔄 Data Engineering & ETL Pipeline

Cricket data is notoriously dirty due to name changes, abbreviations, and misspellings over a 15-year span (e.g., "M Chinnaswamy Stadium" vs "M. Chinnaswamy Stadium" or "V Kohli" vs "Virat Kohli").

**The Pipeline (`backend/etl.js`)**:
1. **Extraction**: The script loops through raw JSON files provided by Cricsheet in `data/data`.
2. **Transformation**:
   - It reads `player_canonical_map.json` and `venue_canonical_map.json` to map dirty names to a clean, standardized format.
   - It calculates the `match_phase` and attaches relational IDs (`innings_id`, `match_id`) to every delivery.
3. **Loading**: It builds the relational SQLite tables (`matches`, `innings`, `deliveries`) and executes batch inserts for maximum performance, writing to `pitchiq.db`.

---

## 🎨 Frontend Features & UX

The frontend is a React Single Page Application (SPA) prioritizing user experience, utilizing glassmorphism styles and highly responsive layouts.

- **Player Intel**: A comprehensive dashboard allowing users to search for any player and instantly view their Batting and Bowling profiles. Includes a dynamic `FilterBar` to filter by opposition, situation (chasing/defending), venue, and season.
- **Compare**: A dedicated tool to place two players side-by-side using a beautiful `Recharts` Radar Chart to compare 5 distinct dimensions against global IPL averages.
- **Head-to-Head**: A matchup tool where users select a Batter and a Bowler to view every delivery they've bowled to each other.
- **Top Performers**: Global leaderboards with dynamic sorting based on advanced metrics.
- **Ask PitchIQ**: A floating chat interface for the heuristic NLP query engine.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### 1. Database Generation (ETL)
If the `pitchiq.db` file does not exist in `backend/`, you must build it from the raw Cricsheet data.
```bash
cd backend
node etl.js
```

### 2. Start the Backend Server
```bash
cd backend
npm install
npm run dev
```
*(The Express server will start on `http://localhost:3000`)*

### 3. Start the Frontend Client
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*(The Vite dev server will start on `http://localhost:5174` and open in your browser)*

---

## 💡 Interview Talking Points (Cheat Sheet)

If discussing this project in a technical interview, emphasize the following engineering decisions:
- **Adapter Pattern & Database**: Explain why you chose `sql.js` (SQLite WASM) for lightning-fast reads on ball-by-ball aggregations (zero network latency) and how you wrapped it in `db.js` to mimic `better-sqlite3`.
- **Backend Architecture Refactoring**: Mention how the backend was scaled from a monolithic `server.js` file into a modular `routes/` and `controllers/` architecture using Express router chaining and middleware dependency injection (`req.db`).
- **Data Engineering**: Explain how you handled messy real-world data (name changes, misspellings) using canonical mapping JSON files and a custom Node.js ETL pipeline.
- **Complex SQL Aggregations**: Highlight queries that calculate advanced metrics (like the all-rounder score or phase-by-phase data) directly in SQL using conditional aggregation (`SUM(CASE WHEN...)`) rather than doing heavy computation in JavaScript arrays.
- **Heuristic NLP Engine**: Explain how you built a text parser that translates natural language (e.g. "Kohli in powerplay") into parameterized SQL clauses.
