const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const csvParser = require("csv-parser");

const TRAFFIC_WEATHER_FILE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "traffic_weather_latest.csv"
);

let cachedRows = null;
let cachedMtimeMs = 0;

function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", () => {
        resolve(rows);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

async function getTrafficWeatherRows() {
  let fileStats;

  try {
    fileStats = await fsp.stat(TRAFFIC_WEATHER_FILE_PATH);
  } catch (error) {
    const wrappedError = new Error("Unable to access local traffic weather CSV file.");
    wrappedError.statusCode = 500;
    throw wrappedError;
  }

  if (cachedRows && cachedMtimeMs === fileStats.mtimeMs) {
    return cachedRows;
  }

  try {
    const rows = await parseCsvFile(TRAFFIC_WEATHER_FILE_PATH);
    cachedRows = rows;
    cachedMtimeMs = fileStats.mtimeMs;
    return rows;
  } catch (error) {
    const wrappedError = new Error("Unable to parse local traffic weather CSV file.");
    wrappedError.statusCode = 500;
    throw wrappedError;
  }
}

module.exports = {
  getTrafficWeatherRows,
  TRAFFIC_WEATHER_FILE_PATH,
};