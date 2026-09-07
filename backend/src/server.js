const http = require("http");
const fs = require("fs");
const app = require("./app");
const env = require("./config/env");
const { connectDb } = require("./config/db");
const { initSocket } = require("./sockets/socket");
const { startExpiryJob } = require("./jobs/expiry.job");
const { uploadsDir } = require("./utils/imagePath");

async function startServer() {
  await connectDb();
  fs.mkdirSync(uploadsDir, { recursive: true });

  const server = http.createServer(app);
  initSocket(server);
  startExpiryJob();

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
