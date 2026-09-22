const http = require("http");
const app = require("./app");
const env = require("./config/env");
const { connectDb } = require("./config/db");
const { initSocket } = require("./sockets/socket");
const { startExpiryJob } = require("./jobs/expiry.job");
const { expireDonationsAndNotify } = require("./services/donation.service");

async function startServer() {
  await connectDb();
  await expireDonationsAndNotify().catch((error) => {
    console.error("Initial expiry sweep failed:", error.message);
  });

  const server = http.createServer(app);
  initSocket(server);
  startExpiryJob();

  server.listen(env.port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
