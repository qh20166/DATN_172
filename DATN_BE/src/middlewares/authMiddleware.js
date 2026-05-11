const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Unauthorized.",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Missing JWT_SECRET in environment variables.",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload && payload.tokenType && payload.tokenType !== "access") {
      return res.status(401).json({
        message: "Invalid or expired token.",
      });
    }

    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

module.exports = {
  authenticateToken,
};
