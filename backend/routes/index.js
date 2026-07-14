/**
 * routes/index.js — Route aggregator
 * 
 * Mounts all domain-specific routers under /api.
 * Some routes (matchup, momentum, matches) don't nest under /match,
 * so they are mounted at the root level of this router.
 */

const router = require('express').Router();
const matchController = require('../controllers/matchController');

// Domain-specific route modules
const playerRoutes = require('./playerRoutes');
const matchRoutes = require('./matchRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');
const metaRoutes = require('./metaRoutes');

// Mount route modules
router.use('/player', playerRoutes);
router.use('/match', matchRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/', metaRoutes);

// Routes that don't nest under /match but belong to matchController
router.get('/matchup', matchController.getMatchup);
router.get('/momentum/:matchId', matchController.getMomentum);
router.get('/matches', matchController.getMatches);

module.exports = router;
