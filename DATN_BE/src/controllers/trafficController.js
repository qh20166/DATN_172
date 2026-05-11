const { getLatestTrafficWeatherData } = require("../services/trafficService");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function parsePositiveInteger(value, fallback) {
	const parsedValue = Number.parseInt(String(value || ""), 10);

	if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
		return fallback;
	}

	return parsedValue;
}

async function getLatestTrafficWeather(req, res, next) {
	try {
		const rows = await getLatestTrafficWeatherData();
		const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE);
		const requestedLimit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
		const limit = Math.min(requestedLimit, MAX_LIMIT);
		const totalItems = rows.length;
		const totalPages = Math.max(1, Math.ceil(totalItems / limit));
		const normalizedPage = Math.min(page, totalPages);
		const startIndex = (normalizedPage - 1) * limit;
		const paginatedRows = rows.slice(startIndex, startIndex + limit);

		return res.status(200).json({
			source: "traffic_weather_latest.csv",
			count: paginatedRows.length,
			pagination: {
				page: normalizedPage,
				limit,
				totalItems,
				totalPages,
			},
			data: paginatedRows,
		});
	} catch (error) {
		return next(error);
	}
}

module.exports = {
	getLatestTrafficWeather,
};
