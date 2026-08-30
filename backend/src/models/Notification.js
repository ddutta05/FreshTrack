const mongoose = require("mongoose");
const { NOTIFICATION_TYPES } = require("../utils/constants");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation"
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DonationRequest"
    }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
