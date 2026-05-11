/**
 * Logging Middleware using Winston
 * Logs HTTP requests, responses, and application events
 */

const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "..", "..", "logs");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "traffic-decision-backend" },
  transports: [
    // Error log
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    }),
    // Combined log
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level}]: ${message}`)
      ),
    })
  );
}

/**
 * HTTP request logging middleware
 */
function httpLoggingMiddleware(req, res, next) {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? "warn" : "info";

    logger.log(level, `${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  });

  next();
}

/**
 * Application event logger
 */
function logEvent(level, message, metadata = {}) {
  logger.log(level, message, metadata);
}

module.exports = {
  logger,
  httpLoggingMiddleware,
  logEvent,
};
