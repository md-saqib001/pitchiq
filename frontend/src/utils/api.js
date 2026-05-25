import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:3000/api',
    timeout: 15000,
});

// Response interceptor for consistent error handling
API.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
        console.error(`[PitchIQ API] ${error.config?.method?.toUpperCase()} ${error.config?.url}: ${message}`);
        return Promise.reject({ message, status: error.response?.status });
    }
);

// ──────────────────────────────────────────────
// Player Stats
// ──────────────────────────────────────────────

export const fetchPlayerStats = (name, filters = {}) => {
    const params = {};
    if (filters.phase && filters.phase !== 'all') params.phase = filters.phase;
    if (filters.venue) params.venue = filters.venue;
    if (filters.situation && filters.situation !== 'all') params.situation = filters.situation;
    if (filters.target && filters.target !== 'any' && filters.situation === 'chase') {
        params.target_min = parseInt(filters.target.replace('+', ''));
    }
    if (filters.season && filters.season !== 'all') params.season = filters.season;
    if (filters.opposition) params.opposition = filters.opposition;
    return API.get(`/player/${encodeURIComponent(name)}/stats`, { params });
};

export const fetchPlayerBowling = (name, filters = {}) => {
    const params = {};
    if (filters.phase && filters.phase !== 'all') params.phase = filters.phase;
    if (filters.venue) params.venue = filters.venue;
    if (filters.situation && filters.situation !== 'all') params.situation = filters.situation;
    if (filters.target && filters.target !== 'any' && filters.situation === 'chase') {
        params.target_min = parseInt(filters.target.replace('+', ''));
    }
    if (filters.season && filters.season !== 'all') params.season = filters.season;
    if (filters.opposition) params.opposition = filters.opposition;
    return API.get(`/player/${encodeURIComponent(name)}/bowling_stats`, { params });
};

export const fetchSeasonTrend = (name) =>
    API.get(`/player/${encodeURIComponent(name)}/season_trend`);

export const fetchPhaseBreakdown = (name, filters = {}) => {
    const params = {};
    if (filters.venue) params.venue = filters.venue;
    if (filters.situation && filters.situation !== 'all') params.situation = filters.situation;
    if (filters.season && filters.season !== 'all') params.season = filters.season;
    return API.get(`/player/${encodeURIComponent(name)}/phase_breakdown`, { params });
};

export const fetchPlayerBowlingPhaseBreakdown = (name, filters = {}) => {
    const params = {};
    if (filters.venue) params.venue = filters.venue;
    if (filters.situation && filters.situation !== 'all') params.situation = filters.situation;
    if (filters.season && filters.season !== 'all') params.season = filters.season;
    return API.get(`/player/${encodeURIComponent(name)}/bowling_phase_breakdown`, { params });
};

export const fetchVenueStats = (name) =>
    API.get(`/player/${encodeURIComponent(name)}/venue_stats`);

export const fetchPlayerBowlingVenueStats = (name) =>
    API.get(`/player/${encodeURIComponent(name)}/bowling_venue_stats`);

export const fetchCompareStats = (name) =>
    API.get(`/player/${encodeURIComponent(name)}/compare_stats`);

export const fetchRecentInnings = (name) =>
    API.get(`/player/${encodeURIComponent(name)}/recent_innings`);

export const fetchPlayerBowlingRecentInnings = (name) =>
    API.get(`/player/${encodeURIComponent(name)}/bowling_recent_innings`);

// ──────────────────────────────────────────────
// Global / Meta
// ──────────────────────────────────────────────

export const fetchIPLAverages = () => API.get('/ipl_averages');

export const fetchVenues = () => API.get('/venues');

export const fetchTeams = () => API.get('/teams');

export const fetchPlayers = () => API.get('/players');

export const fetchLeaderboard = (params = {}) =>
    API.get('/leaderboard/batting', { params });

export const fetchBowlingLeaderboard = (params = {}) =>
    API.get('/leaderboard/bowling', { params });

export const fetchAllrounderLeaderboard = (params = {}) =>
    API.get('/leaderboard/allrounder', { params });

export const askPitchIQ = (query) =>
    API.post('/ask', { query });

export const fetchMatchesList = (params = {}) =>
    API.get('/matches', { params });

export const fetchMatchDetails = (matchId) =>
    API.get(`/match/${matchId}`);

export const fetchMatchScorecard = (matchId) =>
    API.get(`/match/${matchId}/scorecard`);

export const fetchPlayerMatchPerformance = (matchId, playerName) =>
    API.get(`/match/${matchId}/player/${encodeURIComponent(playerName)}`);

export const fetchMatchMomentum = (matchId) =>
    API.get(`/momentum/${matchId}`);

export const fetchMatchup = (batter, bowler) =>
    API.get('/matchup', { params: { batter, bowler } });

export const fetchPlayersSummary = (params = {}) =>
    API.get('/players/summary', { params });

export default API;
