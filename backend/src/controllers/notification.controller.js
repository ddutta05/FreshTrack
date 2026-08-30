const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { AppError } = require("../utils/errors");
const { getPagination, toPagination } = require("../utils/pagination");

function toNotificationClient(doc) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    message: doc.message,
    read: doc.read,
    donationId: doc.donationId ? doc.donationId.toString() : undefined,
    requestId: doc.requestId ? doc.requestId.toString() : undefined,
    createdAt: doc.createdAt
  };
}

const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { userId: req.user.id };

  const [total, items] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  const mapped = items.map(toNotificationClient);

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "Notifications fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "Notifications fetched", mapped);
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ userId: req.user.id, read: false });
  return success(res, 200, "Unread count fetched", { unreadCount: count });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
  }
  if (notification.userId.toString() !== req.user.id) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  notification.read = true;
  await notification.save();

  return success(res, 200, "Notification marked as read", toNotificationClient(notification));
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });
  return success(res, 200, "All notifications marked as read", null);
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead
};
