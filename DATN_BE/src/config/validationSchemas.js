/**
 * Validation Schemas using Joi
 * Validates all API request inputs
 */

const Joi = require("joi");

const weatherInputSchema = Joi.object({
  weather_description: Joi.string().optional(),
  temperature_2m_max: Joi.number().optional(),
  temperature_2m_min: Joi.number().optional(),
  apparent_temperature_max: Joi.number().optional(),
  apparent_temperature_min: Joi.number().optional(),
  precipitation_sum: Joi.number().optional(),
  precipitation_probability_max: Joi.number().optional(),
  windspeed_10m_max: Joi.number().optional(),
}).unknown(true);

const trafficDssPredictSchema = Joi.object({
  lat: Joi.number().required().messages({
    "number.base": "lat must be a number",
    "any.required": "lat is required",
  }),
  lon: Joi.number().required().messages({
    "number.base": "lon must be a number",
    "any.required": "lon is required",
  }),
  time: Joi.alternatives().try(Joi.string(), Joi.date()).required().messages({
    "any.required": "time is required",
  }),
  weather: weatherInputSchema.required().messages({
    "object.base": "weather must be an object",
    "any.required": "weather is required",
  }),
}).unknown(false);

const trafficDssBatchPredictSchema = Joi.object({
  items: Joi.array().items(trafficDssPredictSchema).min(1).required().messages({
    "array.min": "At least one prediction item is required",
    "any.required": "items is required",
  }),
}).unknown(false);

const trafficDataSchema = Joi.object({
  segmentId: Joi.string().required().messages({
    "string.empty": "segmentId cannot be empty",
    "any.required": "segmentId is required",
  }),
  name_vn: Joi.string().optional(),
  congestionIndex: Joi.number().min(0).max(1).optional(),
  currentSpeed: Joi.number().min(0).optional(),
  speedLimitRatio: Joi.number().optional(),
  jamFactor: Joi.number().min(0).max(1).optional(),
  incidentFlag: Joi.number().min(0).max(1).optional(),
  route_distance_m: Joi.number().min(0).optional(),
  weathercode: Joi.number().optional(),
  precipitation_probability_max: Joi.number().min(0).max(100).optional(),
  windspeed_10m_max: Joi.number().min(0).optional(),
}).unknown(true);

const predictRequestSchema = Joi.object({
  traffic_data: trafficDataSchema.required().messages({
    "object.base": "traffic_data must be an object",
    "any.required": "traffic_data is required",
  }),
  weather_data: Joi.object().optional().unknown(true),
}).unknown(false);

const routeRecommendationRequestSchema = Joi.object({
  routes: Joi.array()
    .items(
      Joi.object({
        segmentId: Joi.string().required(),
        name_vn: Joi.string().optional(),
        distance_m: Joi.number().optional(),
      }).unknown(true)
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one route is required",
      "any.required": "routes array is required",
    }),
  traffic_data_map: Joi.object().optional().unknown(true),
  weather_data: Joi.object().optional().unknown(true),
}).unknown(false);

const batchPredictRequestSchema = Joi.object({
  traffic_data_array: Joi.array()
    .items(trafficDataSchema)
    .min(1)
    .required()
    .messages({
      "array.min": "At least one traffic data point is required",
      "any.required": "traffic_data_array is required",
    }),
  weather_data: Joi.object().optional().unknown(true),
}).unknown(false);

const incidentDetectionRequestSchema = Joi.object({
  traffic_data_array: Joi.array()
    .items(trafficDataSchema)
    .min(1)
    .required(),
  historical_avg_map: Joi.object().optional().unknown(true),
}).unknown(false);

const trafficStatusRequestSchema = Joi.object({
  traffic_data_array: Joi.array()
    .items(trafficDataSchema)
    .min(0)
    .optional(),
  period: Joi.string()
    .valid("hourly", "daily", "overall")
    .optional()
    .default("overall"),
}).unknown(false);

/**
 * DSS Route Recommendation Schema
 * Validates origin and destination parameters
 */
const dssRouteRecommendationSchema = Joi.object({
  origin: Joi.string()
    .required()
    .min(2)
    .messages({
      "string.empty": "origin không thể trống",
      "string.min": "origin phải có ít nhất 2 ký tự",
      "any.required": "origin là bắt buộc",
    }),
  destination: Joi.string()
    .required()
    .min(2)
    .messages({
      "string.empty": "destination không thể trống",
      "string.min": "destination phải có ít nhất 2 ký tự",
      "any.required": "destination là bắt buộc",
    }),
}).unknown(false);

function validateRequest(data, schema) {
  const { error, value } = schema.validate(data, { abortEarly: false });

  if (error) {
    const messages = error.details.map((d) => d.message).join("; ");
    const err = new Error(messages);
    err.statusCode = 400;
    throw err;
  }

  return value;
}

module.exports = {
  validateRequest,
  weatherInputSchema,
  trafficDssPredictSchema,
  trafficDssBatchPredictSchema,
  predictRequestSchema,
  routeRecommendationRequestSchema,
  batchPredictRequestSchema,
  incidentDetectionRequestSchema,
  trafficStatusRequestSchema,
  dssRouteRecommendationSchema,
};
