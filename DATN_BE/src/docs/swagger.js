const swaggerJsdoc = require("swagger-jsdoc");

const port = Number(process.env.PORT) || 3000;
const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;

const swaggerOptions = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "DATN Backend API",
      version: "1.0.0",
      description: "Swagger documentation for DATN backend APIs.",
    },
    servers: [
      {
        url: serverUrl,
        description: "Active server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Health check API",
      },
      {
        name: "Auth",
        description: "Authentication APIs",
      },
      {
        name: "Traffic",
        description: "Traffic and weather data APIs",
      },
      {
        name: "Decision",
        description: "Decision support APIs for frontend recommendations",
      },
      {
        name: "ML",
        description: "Machine learning traffic prediction APIs",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "67d8f98a8e9a8e4d1278c123",
            },
            fullName: {
              type: "string",
              example: "Naftin",
            },
            email: {
              type: "string",
              format: "email",
              example: "naftin@example.com",
            },
            phoneNumber: {
              type: "string",
              nullable: true,
              example: "+84901234567",
            },
            avatarUrl: {
              type: "string",
              nullable: true,
              example: "https://cdn.example.com/avatars/user-1.png",
            },
            addresses: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Address",
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-03-18T08:22:14.123Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-03-18T08:22:14.123Z",
            },
          },
          required: ["id", "fullName", "email", "addresses", "createdAt", "updatedAt"],
        },
        Address: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "67d8f98a8e9a8e4d1278c999",
            },
            label: {
              type: "string",
              example: "home",
            },
            address: {
              type: "string",
              example: "123 Le Loi, Ben Nghe, Quan 1, Ho Chi Minh",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-03-21T09:30:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-03-21T09:30:00.000Z",
            },
          },
          required: ["id", "label", "address", "createdAt", "updatedAt"],
        },
        RegisterRequest: {
          type: "object",
          properties: {
            fullName: {
              type: "string",
              example: "Naftin",
            },
            email: {
              type: "string",
              format: "email",
              example: "naftin@example.com",
            },
            phoneNumber: {
              type: "string",
              example: "+84901234567",
            },
            password: {
              type: "string",
              format: "password",
              minLength: 6,
              example: "123456",
            },
          },
          required: ["email", "password"],
        },
        UpdateProfileRequest: {
          type: "object",
          properties: {
            fullName: {
              type: "string",
              example: "Naftin Updated",
            },
            email: {
              type: "string",
              format: "email",
              example: "naftin.new@example.com",
            },
            phoneNumber: {
              type: "string",
              example: "+84901234568",
            },
          },
          description:
            "At least one field is required: fullName, email, or phoneNumber.",
        },
        ChangePasswordRequest: {
          type: "object",
          properties: {
            currentPassword: {
              type: "string",
              format: "password",
              example: "123456",
            },
            newPassword: {
              type: "string",
              format: "password",
              minLength: 6,
              example: "654321",
            },
          },
          required: ["currentPassword", "newPassword"],
        },
        UpdateAvatarRequest: {
          type: "object",
          properties: {
            avatar: {
              type: "string",
              format: "binary",
              description: "Image file (jpeg, png, webp, gif), max 2MB.",
            },
            remove: {
              type: "boolean",
              example: false,
              description: "Set true to remove current avatar. If true, avatar file is optional.",
            },
          },
        },
        LoginRequest: {
          type: "object",
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "naftin@example.com",
            },
            password: {
              type: "string",
              format: "password",
              example: "123456",
            },
          },
          required: ["email", "password"],
        },
        RefreshTokenRequest: {
          type: "object",
          properties: {
            refreshToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
          required: ["refreshToken"],
        },
        LogoutRequest: {
          type: "object",
          properties: {
            refreshToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
          required: ["refreshToken"],
        },
        AuthSuccessResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Login successful.",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
            accessToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
          required: ["message", "user", "accessToken", "refreshToken"],
        },
        LogoutResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Logout successful.",
            },
          },
          required: ["message"],
        },
        MeResponse: {
          type: "object",
          properties: {
            user: {
              $ref: "#/components/schemas/User",
            },
          },
          required: ["user"],
        },
        SaveAddressRequest: {
          type: "object",
          properties: {
            label: {
              type: "string",
              example: "work",
            },
            address: {
              type: "string",
              example: "Toa nha ABC, Duong Nguyen Hue, Quan 1, Ho Chi Minh",
            },
          },
          required: ["label", "address"],
        },
        UpdateAddressRequest: {
          type: "object",
          properties: {
            label: {
              type: "string",
              example: "home",
            },
            address: {
              type: "string",
              example: "456 Nguyen Trai, Phuong 8, Quan 5, Ho Chi Minh",
            },
          },
          description: "At least one field is required: label or address.",
        },
        SaveAddressResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Address saved successfully.",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
          required: ["message", "user"],
        },
        AddressActionResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Address updated successfully.",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
          required: ["message", "user"],
        },
        ErrorResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Invalid email or password.",
            },
          },
          required: ["message"],
        },
        TrafficWeatherRow: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
          example: {
            segmentId: "0011fbb6aaa8e16f8ec56fe7e1f253e0",
            name_vn: "Quach Thi Trang",
            currentSpeed: "39.5",
            weather_description: "Troi nhieu may",
            time: "2026-03-09",
          },
        },
        TrafficWeatherLatestResponse: {
          type: "object",
          properties: {
            source: {
              type: "string",
              example: "traffic_weather_latest.csv",
            },
            count: {
              type: "integer",
              example: 100,
            },
            pagination: {
              type: "object",
              properties: {
                page: {
                  type: "integer",
                  example: 1,
                },
                limit: {
                  type: "integer",
                  example: 100,
                },
                totalItems: {
                  type: "integer",
                  example: 90695,
                },
                totalPages: {
                  type: "integer",
                  example: 907,
                },
              },
              required: ["page", "limit", "totalItems", "totalPages"],
            },
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/TrafficWeatherRow",
              },
            },
          },
          required: ["source", "count", "pagination", "data"],
        },
        DecisionSummaryResponse: {
          type: "object",
          properties: {
            source: {
              type: "string",
              example: "data/traffic_weather_latest.csv",
            },
            filters: {
              type: "object",
              properties: {
                dayType: {
                  type: "string",
                  example: "Weekday",
                },
                hourOfDay: {
                  type: "integer",
                  nullable: true,
                  example: 8,
                },
                minLevel: {
                  type: "string",
                  example: "medium",
                },
                limit: {
                  type: "integer",
                  example: 10,
                },
              },
            },
            totalRecords: {
              type: "integer",
              example: 15800,
            },
            metrics: {
              type: "object",
              properties: {
                avgCurrentSpeed: {
                  type: "number",
                  example: 24.16,
                },
                avgCongestionIndex: {
                  type: "number",
                  example: 0.61,
                },
                avgDecisionScore: {
                  type: "number",
                  example: 63.4,
                },
                incidentRatePercent: {
                  type: "number",
                  example: 5.7,
                },
              },
              required: [
                "avgCurrentSpeed",
                "avgCongestionIndex",
                "avgDecisionScore",
                "incidentRatePercent",
              ],
            },
            losDistribution: {
              type: "object",
              additionalProperties: {
                type: "integer",
              },
            },
            decisionLevelDistribution: {
              type: "object",
              properties: {
                low: {
                  type: "integer",
                  example: 2100,
                },
                medium: {
                  type: "integer",
                  example: 8200,
                },
                high: {
                  type: "integer",
                  example: 4700,
                },
                critical: {
                  type: "integer",
                  example: 800,
                },
              },
              required: ["low", "medium", "high", "critical"],
            },
            generatedAt: {
              type: "string",
              format: "date-time",
            },
          },
          required: [
            "source",
            "filters",
            "totalRecords",
            "metrics",
            "losDistribution",
            "decisionLevelDistribution",
            "generatedAt",
          ],
        },
        DecisionRecommendationItem: {
          type: "object",
          properties: {
            segmentId: {
              type: "string",
            },
            segmentName: {
              type: "string",
            },
            decisionScore: {
              type: "number",
              example: 82.5,
            },
            decisionLevel: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
            priority: {
              type: "string",
              enum: ["low", "normal", "high", "urgent"],
            },
            recommendation: {
              type: "string",
            },
            observations: {
              type: "integer",
              example: 12,
            },
            avgCurrentSpeed: {
              type: "number",
              example: 15.2,
            },
            avgCongestionIndex: {
              type: "number",
              example: 0.82,
            },
            incidentRatePercent: {
              type: "number",
              example: 16.7,
            },
            weatherSignals: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: [
            "segmentId",
            "segmentName",
            "decisionScore",
            "decisionLevel",
            "priority",
            "recommendation",
          ],
        },
        DecisionRecommendationResponse: {
          type: "object",
          properties: {
            source: {
              type: "string",
              example: "data/traffic_weather_latest.csv",
            },
            filters: {
              type: "object",
              properties: {
                dayType: {
                  type: "string",
                },
                hourOfDay: {
                  type: "integer",
                  nullable: true,
                },
                minLevel: {
                  type: "string",
                  example: "high",
                },
                limit: {
                  type: "integer",
                  example: 10,
                },
              },
            },
            totalSegments: {
              type: "integer",
              example: 245,
            },
            count: {
              type: "integer",
              example: 10,
            },
            generatedAt: {
              type: "string",
              format: "date-time",
            },
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/DecisionRecommendationItem",
              },
            },
          },
          required: ["source", "filters", "totalSegments", "count", "generatedAt", "data"],
        },
        WeatherInput: {
          type: "object",
          properties: {
            weather_description: {
              type: "string",
              example: "clear sky",
            },
            temperature_2m_max: {
              type: "number",
              example: 33,
            },
            temperature_2m_min: {
              type: "number",
              example: 26,
            },
            apparent_temperature_max: {
              type: "number",
              example: 35,
            },
            apparent_temperature_min: {
              type: "number",
              example: 27,
            },
            precipitation_sum: {
              type: "number",
              example: 0,
            },
            precipitation_probability_max: {
              type: "number",
              example: 5,
            },
            windspeed_10m_max: {
              type: "number",
              example: 12,
            },
          },
          required: ["weather_description"],
        },
        TrafficDssPredictRequest: {
          type: "object",
          properties: {
            lat: {
              type: "number",
              example: 10.776,
              description: "Latitude of the location",
            },
            lon: {
              type: "number",
              example: 106.700,
              description: "Longitude of the location",
            },
            time: {
              type: "string",
              format: "date-time",
              example: "2026-05-06T08:30:00Z",
              description: "Timestamp for the prediction",
            },
            weather: {
              $ref: "#/components/schemas/WeatherInput",
            },
          },
          required: ["lat", "lon", "time", "weather"],
        },
        TrafficDssPredictResponse: {
          type: "object",
          properties: {
            congestion_level: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              example: "HIGH",
              description: "Traffic congestion severity level",
            },
            predicted_speed: {
              type: "number",
              example: 19.3,
              description: "Predicted average speed (km/h)",
            },
            risk_score: {
              type: "number",
              minimum: 0,
              maximum: 1,
              example: 0.718,
              description: "Risk score from 0 (low) to 1 (high)",
            },
            nearest_segment_id: {
              type: "string",
              example: "aecdc48bd5b765a23d6774bcb21df781",
              description: "ID of the nearest traffic segment",
              nullable: true,
            },
          },
          required: ["congestion_level", "predicted_speed", "risk_score"],
        },
        TrafficDssBatchPredictRequest: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/TrafficDssPredictRequest",
              },
              minItems: 1,
              description: "Array of prediction requests",
            },
          },
          required: ["items"],
        },
        TrafficDssBatchPredictResponse: {
          type: "object",
          properties: {
            count: {
              type: "integer",
              example: 2,
              description: "Total number of predictions",
            },
            predictions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: {
                    type: "integer",
                    example: 0,
                  },
                  congestion_level: {
                    type: "string",
                    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                  },
                  predicted_speed: {
                    type: "number",
                  },
                  risk_score: {
                    type: "number",
                  },
                  nearest_segment_id: {
                    type: "string",
                    nullable: true,
                  },
                  error: {
                    type: "string",
                    description: "Error message if prediction failed",
                  },
                },
              },
            },
          },
          required: ["count", "predictions"],
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            200: {
              description: "Server is healthy",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/HealthResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a new user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RegisterRequest",
                },
              },
            },
          },
          responses: {
            201: {
              description: "Register successful",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AuthSuccessResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid request body",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            409: {
              description: "Email already exists",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login with email and password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AuthSuccessResponse",
                  },
                },
              },
            },
            400: {
              description: "Missing email or password",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/refresh-token": {
        post: {
          tags: ["Auth"],
          summary: "Refresh access token using refresh token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RefreshTokenRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Token refreshed successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AuthSuccessResponse",
                  },
                },
              },
            },
            400: {
              description: "Missing refresh token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Invalid or expired refresh token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout and remove current refresh token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LogoutRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Logout successful",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/LogoutResponse",
                  },
                },
              },
            },
            400: {
              description: "Missing refresh token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Invalid or expired refresh token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get authenticated user profile",
          security: [
            {
              bearerAuth: [],
            },
          ],
          responses: {
            200: {
              description: "Authenticated user profile",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/MeResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/profile": {
        patch: {
          tags: ["Auth"],
          summary: "Update authenticated user profile information",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateProfileRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Profile updated",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AddressActionResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid request body",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            409: {
              description: "Email already exists",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/change-password": {
        patch: {
          tags: ["Auth"],
          summary: "Change authenticated user password",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ChangePasswordRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Password changed",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/LogoutResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid request body or current password mismatch",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/profile/password": {
        patch: {
          tags: ["Auth"],
          summary: "Alias endpoint to change authenticated user password",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ChangePasswordRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Password changed",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/LogoutResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid request body or current password mismatch",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/profile/avatar": {
        patch: {
          tags: ["Auth"],
          summary: "Update or remove authenticated user avatar",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  $ref: "#/components/schemas/UpdateAvatarRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Avatar updated",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AddressActionResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid avatar file or request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/addresses": {
        post: {
          tags: ["Auth"],
          summary: "Save an address for authenticated user",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SaveAddressRequest",
                },
              },
            },
          },
          responses: {
            201: {
              description: "Address saved",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/SaveAddressResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid request body",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/addresses/{addressId}": {
        patch: {
          tags: ["Auth"],
          summary: "Update an address for authenticated user",
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: "addressId",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
              description: "Address ID to update",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateAddressRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Address updated",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AddressActionResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid request body",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            404: {
              description: "Address not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Auth"],
          summary: "Delete an address for authenticated user",
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: "addressId",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
              description: "Address ID to delete",
            },
          ],
          responses: {
            200: {
              description: "Address deleted",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AddressActionResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid address ID",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            404: {
              description: "Address not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/traffic/weather/latest": {
        get: {
          tags: ["Traffic"],
          summary: "Get latest traffic weather data from local CSV",
          parameters: [
            {
              name: "page",
              in: "query",
              required: false,
              description: "Page number (default: 1)",
              schema: {
                type: "integer",
                minimum: 1,
                example: 1,
              },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Rows per page (default: 100, max: 1000)",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 1000,
                example: 100,
              },
            },
          ],
          responses: {
            200: {
              description: "Traffic weather data fetched successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/TrafficWeatherLatestResponse",
                  },
                },
              },
            },
              500: {
                description: "Unable to access traffic weather CSV file",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/ErrorResponse",
                    },
                  },
                },
              },
            },
          },
        },
        "/api/decision/traffic/summary": {
          get: {
            tags: ["Decision"],
            summary: "Get decision support summary from local traffic-weather data",
            parameters: [
              {
                name: "dayType",
                in: "query",
                required: false,
                description: "Filter by dayType value, ex: Weekday or Weekend",
                schema: {
                  type: "string",
                  example: "Weekday",
                },
              },
              {
                name: "hourOfDay",
                in: "query",
                required: false,
                description: "Filter by hour of day (0-23)",
                schema: {
                  type: "integer",
                  minimum: 0,
                  maximum: 23,
                  example: 8,
                },
              },
            ],
            responses: {
              200: {
                description: "Decision summary generated successfully",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/DecisionSummaryResponse",
                    },
                  },
                },
              },
              500: {
                description: "Unable to access traffic weather CSV file",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/decision/traffic/recommendations": {
        get: {
          tags: ["Decision"],
          summary: "Get ranked decision recommendations for traffic segments",
          parameters: [
            {
              name: "dayType",
              in: "query",
              required: false,
              description: "Filter by dayType value, ex: Weekday or Weekend",
              schema: {
                type: "string",
                example: "Weekday",
              },
            },
            {
              name: "hourOfDay",
              in: "query",
              required: false,
              description: "Filter by hour of day (0-23)",
              schema: {
                type: "integer",
                minimum: 0,
                maximum: 23,
                example: 17,
              },
            },
            {
              name: "minLevel",
              in: "query",
              required: false,
              description: "Minimum decision level: low, medium, high, critical",
              schema: {
                type: "string",
                example: "high",
              },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Number of segments returned (default 10, max 50)",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 50,
                example: 10,
              },
            },
          ],
          responses: {
            200: {
              description: "Decision recommendations generated successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/DecisionRecommendationResponse",
                  },
                },
              },
            },
            500: {
              description: "Unable to access traffic weather CSV file",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/ml/predict": {
        post: {
          tags: ["ML"],
          summary: "Predict traffic congestion and speed for a location",
          description: "Uses TensorFlow.js trained model to predict congestion level, speed, and risk score based on location, time, and weather conditions",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TrafficDssPredictRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Traffic prediction generated successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/TrafficDssPredictResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid request body (missing or invalid lat, lon, time, or weather)",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            500: {
              description: "Server error or model not initialized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/ml/predict/batch": {
        post: {
          tags: ["ML"],
          summary: "Predict traffic for multiple locations in batch",
          description: "Submit multiple prediction requests at once and receive batch results with per-item error handling",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TrafficDssBatchPredictRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Batch predictions completed",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/TrafficDssBatchPredictResponse",
                  },
                },
              },
            },
            400: {
              description: "Invalid batch request (items array required with at least 1 item)",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            500: {
              description: "Server error during batch processing",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;
