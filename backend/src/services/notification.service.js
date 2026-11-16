const Notification = require("../models/Notification");
const { emitToUser } = require("../sockets/socket");

const pendingEventsBySession = new WeakMap();

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

  if (session) {
    const pendingEvents = pendingEventsBySession.get(session) || [];
    pendingEvents.push({ userId: userId.toString(), payload });
    pendingEventsBySession.set(session, pendingEvents);
  } else {
    emitToUser(userId.toString(), "notification:new", payload);
  }

  return notification;
}

function emitSessionNotifications(session) {
  const pendingEvents = pendingEventsBySession.get(session) || [];
  pendingEventsBySession.delete(session);

  for (const { userId, payload } of pendingEvents) {
    emitToUser(userId, "notification:new", payload);
  }
}

module.exports = {
  createNotification,
  emitSessionNotifications
};
