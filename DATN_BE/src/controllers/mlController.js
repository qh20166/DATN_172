/**
 * ML Controllers
 * Handles traffic prediction, routing, and incident detection endpoints
 */

const { predictTraffic, predictTrafficBatch } = require("../services/trafficDssModelService");
const { recommendRoute, compareRoutes } = require("../services/routeRecommendationService");
const { detectIncident, detectIncidentsBatch } = require("../services/incidentDetectionService");
const { getTrafficStatus, getTrafficStatusByPeriod } = require("../services/trafficStatusService");
const { validateRequest, trafficDssPredictSchema, trafficDssBatchPredictSchema, routeRecommendationRequestSchema, batchPredictRequestSchema, incidentDetectionRequestSchema, trafficStatusRequestSchema } = require("../config/validationSchemas");

/**
 * POST /api/ml/predict
 * Single traffic prediction
 */
async function predict(req, res, next) {
  try {
    const input = validateRequest(req.body, trafficDssPredictSchema);
    const result = await predictTraffic(input);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/ml/predict-batch
 * Batch traffic prediction for multiple segments
 */
async function predictBatch(req, res, next) {
  try {
    const input = validateRequest(req.body, trafficDssBatchPredictSchema);
    const result = await predictTrafficBatch(input.items);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/ml/recommend-route
 * Route recommendation and ranking
 */
async function recommendRouteHandler(req, res, next) {
  try {
    const input = validateRequest(req.body, routeRecommendationRequestSchema);

    const result = await recommendRoute(input.routes, input.traffic_data_map || {}, input.weather_data || {});

    return res.status(200).json({
      message: "Route recommendation generated successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/ml/compare-routes
 * Compare two routes directly
 */
async function compareRoutesHandler(req, res, next) {
  try {
    if (!req.body.route1 || !req.body.route2) {
      return res.status(400).json({
        message: "Both route1 and route2 are required.",
      });
    }

    const result = await compareRoutes(req.body.route1, req.body.route2, req.body.traffic_data_map || {}, req.body.weather_data || {});

    return res.status(200).json({
      message: "Route comparison completed successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/ml/detect-incident
 * Single incident detection
 */
async function detectIncidentHandler(req, res, next) {
  try {
    if (!req.body.traffic_data) {
      return res.status(400).json({
        message: "traffic_data is required.",
      });
    }

    const result = await detectIncident(req.body.traffic_data, req.body.historical_avg);

    return res.status(200).json({
      message: "Incident detection completed successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/ml/detect-incidents
 * Batch incident detection
 */
async function detectIncidentsHandler(req, res, next) {
  try {
    const input = validateRequest(req.body, incidentDetectionRequestSchema);

    const result = await detectIncidentsBatch(input.traffic_data_array, input.historical_avg_map || {});

    return res.status(200).json({
      message: "Batch incident detection completed successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/ml/traffic-status
 * Get aggregated traffic status
 */
async function trafficStatusHandler(req, res, next) {
  try {
    const input = validateRequest(req.body, trafficStatusRequestSchema);

    if (input.period === "overall") {
      const result = await getTrafficStatus(input.traffic_data_array || []);
      return res.status(200).json({
        message: "Traffic status retrieved successfully.",
        data: result,
      });
    }

    const result = await getTrafficStatusByPeriod(input.traffic_data_array || [], input.period);
    return res.status(200).json({
      message: "Traffic status by period retrieved successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  predict,
  predictBatch,
  recommendRouteHandler,
  compareRoutesHandler,
  detectIncidentHandler,
  detectIncidentsHandler,
  trafficStatusHandler,
};
