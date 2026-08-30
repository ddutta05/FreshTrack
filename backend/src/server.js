const http = require("http");
const app = require("./app");
const env = require("./config/env");
const { connectDb } = require("./config/db");
const { initSocket } = require("./sockets/socket");
const { startExpiryJob } = require("./jobs/expiry.job");

async function startServer() {
  await connectDb();

  const server = http.createServer(app);
  initSocket(server);
  startExpiryJob();

  server.listen(env.port, () => {
    console.log(`FreshTrack backend running on port ${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
