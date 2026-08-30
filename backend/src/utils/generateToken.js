const jwt = require("jsonwebtoken");
const env = require("../config/env");

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      sub: user.id,
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

module.exports = generateToken;
