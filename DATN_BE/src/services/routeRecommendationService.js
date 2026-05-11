/**
 * Route Recommendation Service
 * Evaluates and ranks multiple routes based on traffic, weather, time
 */

const { recommendBestRoute } = require("../config/mlModels");

function validateRouteRecommendationInput(routes) {
  if (!Array.isArray(routes)) {
    const error = new Error("routes must be an array.");
    error.statusCode = 400;
    throw error;
  }

  if (routes.length === 0) {
    const error = new Error("At least one route is required.");
    error.statusCode = 400;
    throw error;
  }

  routes.forEach((route, idx) => {
    if (!route.segmentId) {
      const error = new Error(`Route at index ${idx} must have segmentId.`);
      error.statusCode = 400;
      throw error;
    }
  });
}

/**
 * Recommend best route from alternatives
 */
async function recommendRoute(inputRoutes, trafficDataMap = {}, weatherData = {}) {
  validateRouteRecommendationInput(inputRoutes);

  const result = recommendBestRoute(inputRoutes, trafficDataMap, weatherData);

  return {
    best_route: result.best_route,
    alternatives: result.alternatives,
    total_alternatives: result.alternatives.length,
    recommendation_basis: {
      factors: ["congestion_level", "eta_time", "recommended_action"],
      weights: { congestion: 0.5, eta: 0.3, safety: 0.2 },
    },
    timestamp: result.timestamp,
  };
}

/**
 * Compare two routes
 */
async function compareRoutes(route1, route2, trafficDataMap = {}, weatherData = {}) {
  if (!route1 || !route2) {
    const error = new Error("Both route1 and route2 are required.");
    error.statusCode = 400;
    throw error;
  }

  const result = await recommendRoute([route1, route2], trafficDataMap, weatherData);

  return {
    winner: result.best_route,
    loser: result.alternatives[0] || null,
    comparison: {
      winner_score: result.best_route?.score,
      loser_score: result.alternatives[0]?.score,
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  recommendRoute,
  compareRoutes,
};
