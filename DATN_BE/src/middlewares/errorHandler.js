function notFoundHandler(req, res) {
  return res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
}

function errorHandler(error, req, res, next) {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      message: "Invalid JSON payload.",
    });
  }

  const duplicateKeyErrorCode = 11000;
  const statusCode = error.statusCode || (error.code === duplicateKeyErrorCode ? 409 : 500);
  const message = statusCode === 500 ? "Internal server error." : error.message;

  if (statusCode === 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    message,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
