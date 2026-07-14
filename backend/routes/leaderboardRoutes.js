/**
 * routes/leaderboardRoutes.js — Leaderboard API routes
 */

const router = require('express').Router();
const leaderboardController = require('../controllers/leaderboardController');

router.get('/batting', leaderboardController.getBattingLeaderboard);
router.get('/bowling', leaderboardController.getBowlingLeaderboard);
router.get('/allrounder', leaderboardController.getAllrounderLeaderboard);

module.exports = router;
