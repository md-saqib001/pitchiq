/**
 * routes/matchRoutes.js — Match-related API routes
 * 
 * Note: /api/matchup and /api/momentum/:matchId don't nest cleanly under /api/match,
 * so they are registered separately in the route aggregator (routes/index.js).
 */

const router = require('express').Router();
const matchController = require('../controllers/matchController');

router.get('/:matchId', matchController.getMatchById);
router.get('/:matchId/scorecard', matchController.getScorecard);
router.get('/:matchId/player/:playerName', matchController.getPlayerMatchPerformance);

module.exports = router;
