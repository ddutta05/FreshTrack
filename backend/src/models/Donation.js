const mongoose = require("mongoose");
const { DONATION_STATUS } = require("../utils/constants");

const donationSchema = new mongoose.Schema(
  {
    foodName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true
    },
    quantity: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    image: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
      index: true
    },
    availableUntil: {
      type: Date,
      required: true,
      index: true
    },
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(DONATION_STATUS),
      default: DONATION_STATUS.AVAILABLE,
      index: true
    }
  },
  { timestamps: true }
);

donationSchema.index({ foodName: "text", location: "text", category: "text" });
donationSchema.index({ donorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Donation", donationSchema);
