const mongoose = require("mongoose");
const env = require("./env");

let isConnected = false;

function isAtlasUri(uri) {
  return typeof uri === "string" && uri.includes("mongodb.net");
}

async function connectDb() {
  try {
    if (isAtlasUri(env.mongoUri) && env.mongoUri.startsWith("mongodb://")) {
      console.warn("Atlas connection string is using mongodb://. Prefer mongodb+srv:// for Atlas clusters.");
    }

    await mongoose.connect(env.mongoUri, {
      autoIndex: true,
      dbName: env.mongoDbName,
      serverSelectionTimeoutMS: 15000
    });
    isConnected = true;
    console.log("MongoDB connected successfully");
  } catch (error) {
    isConnected = false;
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
}

function getDbStatus() {
  if (mongoose.connection.readyState === 1) {
    return "connected";
  }
  return isConnected ? "connecting" : "disconnected";
}

module.exports = {
  connectDb,
  getDbStatus
};
