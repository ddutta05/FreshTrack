const path = require("path");
const dotenv = require("dotenv");

// Load backend/.env regardless of where the node process is started from.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function normalizeClusterHost(rawCluster) {
  const cluster = (rawCluster || "").trim();
  if (!cluster) return "";
  return cluster
    .replace(/^mongodb\+srv:\/\//i, "")
    .replace(/^mongodb:\/\//i, "")
    .replace(/\/$/, "")
    .split("/")[0];
}

function buildMongoUriFromParts() {
  const username = (process.env.MONGODB_USERNAME || "").trim();
  const password = process.env.MONGODB_PASSWORD || "";
  const clusterHost = normalizeClusterHost(process.env.MONGODB_CLUSTER);
  const dbName = (process.env.MONGODB_DB_NAME || "freshtrack").trim();

  if (!username || !password || !clusterHost) {
    return undefined;
  }

  // Encode credentials to safely handle special characters in usernames/passwords.
  return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${clusterHost}/${dbName}?retryWrites=true&w=majority`;
}

function mustGet(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseOrigins(value, fallback) {
  const entries = (value || fallback || "http://localhost:5173")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return Array.from(new Set(entries));
}

const clientOrigins = parseOrigins(process.env.CLIENT_URL || process.env.CORS_ORIGINS, "http://localhost:5173");

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: mustGet("MONGODB_URI", buildMongoUriFromParts()),
  mongoDbName: (process.env.MONGODB_DB_NAME || "freshtrack").trim(),
  jwtSecret: mustGet("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: clientOrigins[0],
  clientUrls: clientOrigins,
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  expirySweepIntervalMs: Number(process.env.EXPIRY_SWEEP_INTERVAL_MS || 60000),
  adminName: process.env.ADMIN_NAME || "",
  adminEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  groqApiKey: process.env.GROQ_API_KEY || "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY || ""
};

module.exports = env;
