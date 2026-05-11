const express = require("express");
const {
  predict,
  predictBatch,
  recommendRouteHandler,
  compareRoutesHandler,
  detectIncidentHandler,
  detectIncidentsHandler,
  trafficStatusHandler,
} = require("../controllers/mlController");

const router = express.Router();

/**
 * Prediction endpoints
 */
router.post("/predict", predict);
router.post("/predict/batch", predictBatch);
router.post("/predict-batch", predictBatch);

/**
 * Route recommendation endpoints
 */
router.post("/recommend-route", recommendRouteHandler);
router.post("/compare-routes", compareRoutesHandler);

/**
 * Incident detection endpoints
 */
router.post("/detect-incident", detectIncidentHandler);
router.post("/detect-incidents", detectIncidentsHandler);

/**
 * Traffic status endpoint
 */
router.post("/traffic-status", trafficStatusHandler);

module.exports = router;
