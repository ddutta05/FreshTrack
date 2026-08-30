const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function mustGet(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: mustGet("MONGODB_URI"),
  jwtSecret: mustGet("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  expirySweepIntervalMs: Number(process.env.EXPIRY_SWEEP_INTERVAL_MS || 60000),
  adminName: process.env.ADMIN_NAME || "",
  adminEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || ""
};

module.exports = env;
