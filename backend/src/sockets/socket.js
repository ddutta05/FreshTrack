const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const { USER_STATUS } = require("../utils/constants");

const userSockets = new Map();
let ioRef;

function addSocket(userId, socketId) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socketId);
}

function removeSocket(userId, socketId) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(userId);
  }
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const tokenFromAuth = socket.handshake.auth?.token;
      const bearer = socket.handshake.headers.authorization || "";
      const tokenFromHeader = bearer.startsWith("Bearer ") ? bearer.slice(7) : null;
      const token = tokenFromAuth || tokenFromHeader;

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const payload = jwt.verify(token, env.jwtSecret);
      const userId = payload.userId || payload.sub;
      const user = await User.findById(userId).select("role status");
      if (!user || user.status !== USER_STATUS.ACTIVE) {
        return next(new Error("Unauthorized"));
      }

      socket.user = { id: user._id.toString(), role: user.role };
      return next();
    } catch (_error) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    addSocket(socket.user.id, socket.id);

    socket.on("disconnect", () => {
      removeSocket(socket.user.id, socket.id);
    });
  });

  ioRef = io;
  return io;
}

function emitToUser(userId, event, payload) {
  if (!ioRef) return;
  const socketIds = userSockets.get(userId.toString());
  if (!socketIds) return;

  for (const socketId of socketIds.values()) {
    ioRef.to(socketId).emit(event, payload);
  }
}

module.exports = {
  initSocket,
  emitToUser
};
