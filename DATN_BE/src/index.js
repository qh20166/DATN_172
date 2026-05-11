require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const authRoutes = require("./routes/authRoutes");
const trafficRoutes = require("./routes/trafficRoutes");
const decisionRoutes = require("./routes/decisionRoutes");
const mlRoutes = require("./routes/mlRoutes");
const swaggerSpec = require("./docs/swagger");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");
const { httpLoggingMiddleware } = require("./middlewares/loggingMiddleware");
const { cacheMiddleware } = require("./middlewares/cachingMiddleware");
const { connectToDatabase, closeDatabase } = require("./config/database");
const { initializeTrafficDssModel } = require("./services/trafficDssModelService");

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(httpLoggingMiddleware);

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
  });
});

app.get("/api-docs.json", (req, res) => {
  return res.status(200).json(swaggerSpec);
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/traffic", trafficRoutes);
app.use("/api/decision", decisionRoutes);
app.use("/api/ml", cacheMiddleware(300), mlRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  await connectToDatabase();
  await initializeTrafficDssModel();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const gracefulShutdown = async (signal) => {
    console.log(`Received ${signal}. Closing server...`);
    await closeDatabase();

    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    gracefulShutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
  });
}

startServer().catch((error) => {
  console.error("Unable to start server:", error);
  process.exit(1);
});

module.exports = {
  app,
  startServer,
};
