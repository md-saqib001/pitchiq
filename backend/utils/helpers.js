/**
 * utils/helpers.js — Shared utility functions for PitchIQ controllers
 */

/**
 * Maps frontend season strings to the database season format.
 * Some IPL seasons span two calendar years in the database.
 */
const getDbSeason = (season) => {
    if (!season) return season;
    const mapping = {
        '2008': '2007/08',
        '2010': '2009/10',
        '2020': '2020/21'
    };
    return mapping[season] || season;
};

/**
 * Appends common batting filter clauses to a SQL query.
 * Mutates `query` string and `params` array in-place via the returned object.
 *
 * @param {object} filters - { phase, venue, situation, target_min, target_max, season, opposition }
 * @returns {{ clauses: string, params: any[] }}
 */
const buildBattingFilters = (filters) => {
    const { phase, venue, situation, target_min, target_max, season: rawSeason, opposition } = filters;
    const season = getDbSeason(rawSeason);

    let clauses = '';
    const params = [];

    if (phase && phase !== 'all') {
        clauses += ` AND d.match_phase = ?`;
        params.push(phase);
    }
    if (venue) {
        clauses += ` AND m.venue LIKE ?`;
        params.push(`%${venue}%`);
    }
    if (situation === 'chase') {
        clauses += ` AND i.is_chase = 1`;
    } else if (situation === 'defend') {
        clauses += ` AND i.is_chase = 0`;
    }
    if (target_min) {
        clauses += ` AND i.target >= ?`;
        params.push(target_min);
    }
    if (target_max) {
        clauses += ` AND i.target <= ?`;
        params.push(target_max);
    }
    if (season && season !== 'all') {
        clauses += ` AND m.season = ?`;
        params.push(season);
    }
    if (opposition) {
        clauses += ` AND ((m.team1 = ? AND i.batting_team = m.team2) OR (m.team2 = ? AND i.batting_team = m.team1))`;
        params.push(opposition, opposition);
    }

    return { clauses, params };
};

/**
 * Appends common bowling filter clauses to a SQL query.
 * Bowling situation logic is inverted: "chase" means player's team chased (bowled first).
 *
 * @param {object} filters - { phase, venue, situation, target_min, target_max, season, opposition }
 * @returns {{ clauses: string, params: any[] }}
 */
const buildBowlingFilters = (filters) => {
    const { phase, venue, situation, target_min, target_max, season: rawSeason, opposition } = filters;
    const season = getDbSeason(rawSeason);

    let clauses = '';
    const params = [];

    if (phase && phase !== 'all') {
        clauses += ` AND d.match_phase = ?`;
        params.push(phase);
    }
    if (venue) {
        clauses += ` AND m.venue LIKE ?`;
        params.push(`%${venue}%`);
    }
    if (situation === 'chase') {
        // Player's team is chasing → they bowled first (is_chase = 0)
        clauses += ` AND i.is_chase = 0`;
    } else if (situation === 'defend') {
        // Player's team is defending → they bowled second (is_chase = 1)
        clauses += ` AND i.is_chase = 1`;
    }
    if (target_min) {
        clauses += ` AND i.target >= ?`;
        params.push(target_min);
    }
    if (target_max) {
        clauses += ` AND i.target <= ?`;
        params.push(target_max);
    }
    if (season && season !== 'all') {
        clauses += ` AND m.season = ?`;
        params.push(season);
    }
    if (opposition) {
        clauses += ` AND i.batting_team = ?`;
        params.push(opposition);
    }

    return { clauses, params };
};

/**
 * Safely formats a float value, returning 0 if null/undefined.
 */
const formatFloat = (val, decimals = 2) => {
    return val ? parseFloat(val.toFixed(decimals)) : 0;
};

module.exports = {
    getDbSeason,
    buildBattingFilters,
    buildBowlingFilters,
    formatFloat
};
