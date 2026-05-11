/**
 * Caching Middleware using node-cache
 * In-memory caching for frequently accessed predictions and traffic data
 */

const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Cache manager for predictions
 */
const cacheManager = {
  /**
   * Generate cache key
   */
  generateKey(type, data) {
    if (type === "prediction") {
      return `prediction:${data.segmentId}:${data.hourOfDay || "all"}`;
    }
    if (type === "route-recommendation") {
      return `route:${JSON.stringify(data.routeIds || [])}`;
    }
    if (type === "traffic-status") {
      return `traffic-status:${data.period || "overall"}`;
    }
    if (type === "incident-detection") {
      return `incidents:${data.dayType || "all"}`;
    }
    return `cache:${type}:${JSON.stringify(data)}`;
  },

  /**
   * Get value from cache
   */
  get(key) {
    return cache.get(key);
  },

  /**
   * Set value in cache with optional TTL
   */
  set(key, value, ttl = 300) {
    cache.set(key, value, ttl);
    return value;
  },

  /**
   * Delete value from cache
   */
  del(key) {
    cache.del(key);
  },

  /**
   * Clear all cache
   */
  flush() {
    cache.flushAll();
  },

  /**
   * Get cache statistics
   */
  getStats() {
    return cache.getStats();
  },
};

/**
 * Middleware for caching GET requests
 * Usage: app.get('/api/endpoint', cacheMiddleware(5 * 60), handler)
 */
function cacheMiddleware(ttl = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const key = `${req.method}:${req.originalUrl}`;
    const cachedResult = cacheManager.get(key);

    if (cachedResult) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cachedResult);
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (res.statusCode === 200) {
        cacheManager.set(key, data, ttl);
        res.setHeader("X-Cache", "MISS");
      }
      return originalJson(data);
    };

    next();
  };
}

module.exports = {
  cacheManager,
  cacheMiddleware,
};
