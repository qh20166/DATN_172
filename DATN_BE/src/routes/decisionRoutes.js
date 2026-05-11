const express = require("express");
const {
  getTrafficDecisionSummary,
  getTrafficDecisionRecommendations,
  getDSSRouteRecommendation,
} = require("../controllers/decisionController");

const router = express.Router();

router.get("/traffic/summary", getTrafficDecisionSummary);
router.get("/traffic/recommendations", getTrafficDecisionRecommendations);

/**
 * DSS Route Recommendation API
 * GET /api/decisions/traffic/best-route?origin=<location>&destination=<location>
 * 
 * Example: GET /api/decisions/traffic/best-route?origin=Hà Nội&destination=Bắc Ninh
 */
router.get("/traffic/best-route", getDSSRouteRecommendation);

module.exports = router;