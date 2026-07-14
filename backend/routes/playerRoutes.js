/**
 * routes/playerRoutes.js — Player-related API routes
 */

const router = require('express').Router();
const playerController = require('../controllers/playerController');

router.get('/:name/stats', playerController.getBattingStats);
router.get('/:name/bowling_stats', playerController.getBowlingStats);
router.get('/:name/season_trend', playerController.getSeasonTrend);
router.get('/:name/phase_breakdown', playerController.getPhaseBreakdown);
router.get('/:name/bowling_phase_breakdown', playerController.getBowlingPhaseBreakdown);
router.get('/:name/venue_stats', playerController.getVenueStats);
router.get('/:name/bowling_venue_stats', playerController.getBowlingVenueStats);
router.get('/:name/compare_stats', playerController.getCompareStats);
router.get('/:name/recent_innings', playerController.getRecentInnings);
router.get('/:name/bowling_recent_innings', playerController.getBowlingRecentInnings);

module.exports = router;
