const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const { USER_STATUS } = require("../utils/constants");

async function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const userId = payload.userId || payload.sub;
    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("Invalid authentication token", 401, "INVALID_TOKEN"));
    }

    if (user.status === USER_STATUS.DISABLED) {
      return next(new AppError("Account is disabled", 403, "ACCOUNT_DISABLED"));
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      status: user.status
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Authentication token expired", 401, "TOKEN_EXPIRED"));
    }
    return next(new AppError("Invalid authentication token", 401, "INVALID_TOKEN"));
  }
}

module.exports = {
  requireAuth
};
