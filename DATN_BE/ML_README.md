# Traffic Decision Support System Backend

## 📋 Architecture

```
├── config/
│   ├── database.js           # MongoDB connection
│   ├── mlModels.js           # ML prediction logic
│   └── validationSchemas.js  # Joi validation schemas
├── controllers/
│   ├── authController.js     # Auth endpoints
│   ├── trafficController.js  # Traffic data endpoints
│   ├── decisionController.js # Decision support endpoints
│   └── mlController.js       # ML prediction/recommendation endpoints
├── services/
│   ├── authService.js
│   ├── csvDataService.js     # Local CSV reading with cache
│   ├── trafficService.js
│   ├── decisionService.js
│   ├── predictionService.js  # Traffic prediction logic
│   ├── routeRecommendationService.js
│   ├── incidentDetectionService.js
│   └── trafficStatusService.js
├── middlewares/
│   ├── authMiddleware.js
│   ├── errorHandler.js
│   ├── uploadMiddleware.js   # Avatar upload
│   ├── loggingMiddleware.js  # Winston logging
│   └── cachingMiddleware.js  # Node-cache
├── routes/
│   ├── authRoutes.js
│   ├── trafficRoutes.js
│   ├── decisionRoutes.js
│   └── mlRoutes.js           # ML prediction routes
├── docs/
│   └── swagger.js            # OpenAPI documentation
└── index.js                  # Express app entry point
```

## 🚀 Core Features

### 1. Traffic Prediction (`/api/ml/predict`)
- **Input**: Traffic data + weather data
- **Output**: Congestion level, ETA, recommended action, confidence
- **Factors**: congestionIndex, speedLimitRatio, incidentFlag, jamFactor, weather

### 2. Route Recommendation (`/api/ml/recommend-route`)
- **Input**: Multiple routes with traffic data
- **Output**: Best route + alternatives ranked by safety/speed
- **Scoring**: 50% congestion, 30% ETA, 20% safety

### 3. Incident Detection (`/api/ml/detect-incidents`)
- **Input**: Traffic data array + historical averages
- **Output**: Anomaly scores, incident risk levels
- **Detects**: Unusual congestion, speed drops, explicit incidents

### 4. Traffic Status (`/api/ml/traffic-status`)
- **Input**: Traffic data array + period (hourly/daily/overall)
- **Output**: Aggregated metrics, congestion distribution, alerts

## 📦 Installation & Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start server
npm start

# Development
npm run dev
```

### Environment Variables (.env)
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
MONGODB_URI=mongodb://localhost:27017/traffic_db
LOG_LEVEL=info
```

## 🧬 ML Decision Logic

### Congestion Prediction
```
Score = (congestionIndex × 0.4) + 
        ((1 - speedLimitRatio) × 0.3) +
        (incidentFlag × 0.2) +
        (jamFactor × 0.1)

Result:
- Score > 80 → CRITICAL (red)
- Score > 60 → HIGH (orange)
- Score > 40 → MEDIUM (yellow)
- Score ≤ 40 → LOW (green)
```

### ETA Calculation
```
adjustedSpeed = currentSpeed × (1 - congestionIndex × 0.5)
etaMinutes = (distanceKm / adjustedSpeed) × 60
```

### Action Recommendation
```
IF congestion = CRITICAL
  IF severe_weather → AVOID_ROUTE_URGENT
  ELSE → CHANGE_ROUTE
ELSE IF congestion = HIGH
  IF severe_weather → CHANGE_ROUTE
  ELSE → MONITOR_TRAFFIC
ELSE → PROCEED_NORMAL
```

### Anomaly Detection
```
anomalyScore = 0
IF explicit_incident → score += 40
IF congestion_deviation > 0.3 → score += 30
IF speed_ratio < 0.5 → score += 20
IF jam_factor > 0.7 → score += 15

Result:
- Score > 70 → CRITICAL
- Score > 50 → HIGH
- Score ≤ 50 → NORMAL
```

## 📡 API Endpoints

### 1. POST /api/ml/predict
**Single traffic prediction**

Request:
```json
{
  "traffic_data": {
    "segmentId": "seg001",
    "name_vn": "Quach Thi Trang",
    "congestionIndex": 0.75,
    "currentSpeed": 25,
    "speedLimitRatio": 0.5,
    "jamFactor": 0.6,
    "incidentFlag": 0,
    "route_distance_m": 1000
  },
  "weather_data": {
    "weathercode": 51,
    "precipitation_probability_max": 80,
    "windspeed_10m_max": 20
  }
}
```

Response:
```json
{
  "message": "Prediction generated successfully.",
  "data": {
    "segmentId": "seg001",
    "segmentName": "Quach Thi Trang",
    "predicted_congestion": "HIGH",
    "congestion_score": 65,
    "eta_minutes": 2,
    "recommended_action": "MONITOR_TRAFFIC",
    "confidence": 95,
    "predicted_at": "2026-05-02T10:30:00.000Z"
  }
}
```

### 2. POST /api/ml/predict-batch
**Batch predictions for multiple segments**

Request:
```json
{
  "traffic_data_array": [
    {
      "segmentId": "seg001",
      "congestionIndex": 0.75,
      "currentSpeed": 25,
      ...
    },
    {
      "segmentId": "seg002",
      "congestionIndex": 0.4,
      ...
    }
  ],
  "weather_data": {}
}
```

Response:
```json
{
  "message": "Batch predictions generated successfully.",
  "data": {
    "count": 2,
    "predictions": [
      { ... },
      { ... }
    ],
    "timestamp": "2026-05-02T10:30:00.000Z"
  }
}
```

### 3. POST /api/ml/recommend-route
**Route recommendation and ranking**

Request:
```json
{
  "routes": [
    {
      "segmentId": "route_a",
      "name_vn": "Route A (via Highway)",
      "distance_m": 15000
    },
    {
      "segmentId": "route_b",
      "name_vn": "Route B (via Arterial)",
      "distance_m": 18000
    }
  ],
  "traffic_data_map": {
    "route_a": {
      "segmentId": "route_a",
      "congestionIndex": 0.8,
      "currentSpeed": 15
    },
    "route_b": {
      "segmentId": "route_b",
      "congestionIndex": 0.4,
      "currentSpeed": 45
    }
  },
  "weather_data": {}
}
```

Response:
```json
{
  "message": "Route recommendation generated successfully.",
  "data": {
    "best_route": {
      "segmentId": "route_b",
      "score": 85,
      "congestionLevel": "MEDIUM",
      "eta": 24,
      "recommendedAction": "PROCEED_NORMAL",
      "confidence": 90
    },
    "alternatives": [
      {
        "segmentId": "route_a",
        "score": 45,
        ...
      }
    ],
    "total_alternatives": 1,
    "recommendation_basis": {
      "factors": ["congestion_level", "eta_time", "recommended_action"],
      "weights": {
        "congestion": 0.5,
        "eta": 0.3,
        "safety": 0.2
      }
    }
  }
}
```

### 4. POST /api/ml/compare-routes
**Compare two routes directly**

Request:
```json
{
  "route1": {
    "segmentId": "route_a",
    "name_vn": "Route A"
  },
  "route2": {
    "segmentId": "route_b",
    "name_vn": "Route B"
  },
  "traffic_data_map": { ... },
  "weather_data": { ... }
}
```

### 5. POST /api/ml/detect-incident
**Single incident detection**

Request:
```json
{
  "traffic_data": {
    "segmentId": "seg001",
    "congestionIndex": 0.95,
    "currentSpeed": 5,
    "incidentFlag": 1,
    "jamFactor": 0.9
  },
  "historical_avg": {
    "avgCongestion": 0.3,
    "avgSpeed": 45
  }
}
```

Response:
```json
{
  "message": "Incident detection completed successfully.",
  "data": {
    "segmentId": "seg001",
    "anomaly_score": 85,
    "is_anomaly": true,
    "incident_risk": "CRITICAL",
    "explicit_incident_flag": true,
    "detected_at": "2026-05-02T10:30:00.000Z"
  }
}
```

### 6. POST /api/ml/detect-incidents
**Batch incident detection**

Request:
```json
{
  "traffic_data_array": [
    { ... },
    { ... }
  ],
  "historical_avg_map": {
    "seg001": { "avgCongestion": 0.3, "avgSpeed": 45 }
  }
}
```

Response:
```json
{
  "message": "Batch incident detection completed successfully.",
  "data": {
    "total_scanned": 100,
    "anomalies_detected": 8,
    "critical_incidents": 2,
    "high_incidents": 3,
    "incidents": [
      {
        "segmentId": "seg001",
        "anomaly_score": 85,
        "is_anomaly": true,
        "incident_risk": "CRITICAL"
      }
    ],
    "timestamp": "2026-05-02T10:30:00.000Z"
  }
}
```

### 7. POST /api/ml/traffic-status
**Get aggregated traffic status**

Request:
```json
{
  "traffic_data_array": [ ... ],
  "period": "overall"
}
```

Response:
```json
{
  "message": "Traffic status retrieved successfully.",
  "data": {
    "status": "CONGESTED",
    "overall_congestion": "HIGH",
    "metrics": {
      "avg_congestion": 0.68,
      "avg_speed": 28.5,
      "incident_count": 5,
      "incident_rate": 5.0,
      "segments_analyzed": 100
    },
    "congestion_distribution": {
      "low": 25,
      "medium": 40,
      "high": 25,
      "critical": 10
    },
    "alerts": [
      {
        "level": "HIGH",
        "message": "Heavy traffic detected. Average congestion: 68.0%"
      }
    ],
    "timestamp": "2026-05-02T10:30:00.000Z"
  }
}
```

## 🔐 Authentication

All endpoints (except `/health`) require Bearer token:
```
Authorization: Bearer <access_token>
```

Obtain token via:
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

## 📊 Performance & Caching

- **Prediction cache**: 5 minutes TTL
- **Route recommendations**: 10 minutes TTL
- **Traffic status**: 10 minutes TTL
- **Response header**: `X-Cache: HIT/MISS`

Example:
```
GET /api/ml/traffic-status
X-Cache: MISS
...next request...
X-Cache: HIT
```

## 📝 Logging

Logs stored in `/logs/` directory:
- `error.log` - Errors only
- `combined.log` - All logs
- Format: timestamp, level, message, metadata

Configure via `LOG_LEVEL` env var: debug, info, warn, error

## ❌ Error Handling

All errors follow standard format:
```json
{
  "message": "Error description"
}
```

Status codes:
- `200` - Success
- `201` - Created
- `400` - Bad request (validation)
- `401` - Unauthorized
- `404` - Not found
- `409` - Conflict
- `500` - Server error

## 📦 Data Models

### Traffic Data
```typescript
{
  segmentId: string
  name_vn?: string
  congestionIndex: number (0-1)
  currentSpeed: number (km/h)
  speedLimitRatio: number (0-2)
  jamFactor: number (0-1)
  incidentFlag: number (0-1)
  route_distance_m: number
  weathercode?: number
  precipitation_probability_max?: number
  windspeed_10m_max?: number
  ...other fields
}
```

### Route
```typescript
{
  segmentId: string
  name_vn?: string
  distance_m?: number
  ...custom fields
}
```

## 🧪 Testing with Postman

Import collection from `postman_collection.json` (see examples below)

or run sample curl:

```bash
curl -X POST http://localhost:3000/api/ml/predict \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "traffic_data": {
      "segmentId": "seg001",
      "congestionIndex": 0.75,
      "currentSpeed": 25,
      "speedLimitRatio": 0.5
    }
  }'
```

## 📚 Related APIs

- **Decision Support**: `GET /api/decision/traffic/summary`
- **Route Recommendations**: `GET /api/decision/traffic/recommendations`
- **Traffic Data**: `GET /api/traffic/weather/latest`
- **User Profile**: `GET /api/auth/me`

## 🔗 Integration with Frontend

**React/Vue Example**:
```javascript
async function predictTraffic(trafficData) {
  const response = await fetch('/api/ml/predict', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ traffic_data: trafficData })
  });
  return response.json();
}

async function recommendRoute(routes, trafficMap) {
  const response = await fetch('/api/ml/recommend-route', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      routes,
      traffic_data_map: trafficMap
    })
  });
  return response.json();
}
```

## 📌 Version

- **Backend**: Node.js + Express.js
- **ML**: Rule-based decision engine (extensible for pre-trained models)
- **Database**: MongoDB
- **API Docs**: OpenAPI 3.0 (Swagger)

## 📄 License

MIT
