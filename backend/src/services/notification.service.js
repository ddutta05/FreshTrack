const Notification = require("../models/Notification");
const { emitToUser } = require("../sockets/socket");

async function createNotification({ userId, type, message, donationId, requestId }, session) {
  const doc = await Notification.create(
    [
      {
        userId,
        type,
        message,
        donationId,
        requestId
      }
    ],
    session ? { session } : undefined
  );

  const notification = doc[0];
  const payload = {
    id: notification._id.toString(),
    type: notification.type,
    message: notification.message,
    read: notification.read,
    donationId: notification.donationId ? notification.donationId.toString() : undefined,
    requestId: notification.requestId ? notification.requestId.toString() : undefined,
    createdAt: notification.createdAt
  };

  emitToUser(userId.toString(), "notification:new", payload);
  return notification;
}

module.exports = {
  createNotification
};
