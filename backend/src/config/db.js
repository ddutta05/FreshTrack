const mongoose = require("mongoose");
const env = require("./env");

let isConnected = false;

async function connectDb() {
  try {
    await mongoose.connect(env.mongoUri, {
      autoIndex: true
    });
    isConnected = true;
    console.log("MongoDB connected");
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
