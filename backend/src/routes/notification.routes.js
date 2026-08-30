const express = require("express");
const {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead
} = require("../controllers/notification.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validation.middleware");
const { notificationListValidator, notificationIdValidator } = require("../validators/notification.validator");

const router = express.Router();

router.use(requireAuth);
router.get("/", notificationListValidator, validate, getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/:id/read", notificationIdValidator, validate, markNotificationRead);
router.post("/:id/read", notificationIdValidator, validate, markNotificationRead);
router.put("/read-all", markAllRead);
router.post("/read-all", markAllRead);

module.exports = router;
