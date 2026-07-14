/**
 * routes/metaRoutes.js — Meta/lookup and AI query routes
 */

const router = require('express').Router();
const metaController = require('../controllers/metaController');

router.post('/ask', metaController.askPitchIQ);
router.get('/ipl_averages', metaController.getIPLAverages);
router.get('/venues', metaController.getVenues);
router.get('/teams', metaController.getTeams);
router.get('/players', metaController.getPlayers);
router.get('/players/summary', metaController.getPlayersSummary);

module.exports = router;
