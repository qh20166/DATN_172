const { getTrafficWeatherRows } = require("./csvDataService");

async function getLatestTrafficWeatherData() {
	return getTrafficWeatherRows();
}

module.exports = {
	getLatestTrafficWeatherData,
};
