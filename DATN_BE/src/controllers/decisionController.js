const {
  getDecisionSummary,
  getDecisionRecommendations,
  getRouteDSSRecommendation,
} = require("../services/decisionService");
const { validateRequest, dssRouteRecommendationSchema } = require("../config/validationSchemas");

async function getTrafficDecisionSummary(req, res, next) {
  try {
    const result = await getDecisionSummary(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getTrafficDecisionRecommendations(req, res, next) {
  try {
    const result = await getDecisionRecommendations(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * DSS Route Recommendation Controller
 * Finds best route from origin to destination
 */
async function getDSSRouteRecommendation(req, res, next) {
  try {
    const validated = validateRequest(req.query, dssRouteRecommendationSchema);
    const result = await getRouteDSSRecommendation(validated);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getTrafficDecisionSummary,
  getTrafficDecisionRecommendations,
  getDSSRouteRecommendation,
};