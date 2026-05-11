const express = require("express");
const { getLatestTrafficWeather } = require("../controllers/trafficController");

const router = express.Router();

router.get("/weather/latest", getLatestTrafficWeather);

module.exports = router;
