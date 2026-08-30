const mongoose = require("mongoose");
const { REQUEST_STATUS } = require("../utils/constants");

const donationRequestSchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
      required: true,
      index: true
    },
    ngoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
      index: true
    }
  },
  { timestamps: true }
);

donationRequestSchema.index({ donationId: 1, ngoId: 1, createdAt: -1 });
donationRequestSchema.index({ ngoId: 1, status: 1, createdAt: -1 });
donationRequestSchema.index(
  { donationId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REQUEST_STATUS.ACCEPTED }
  }
);

module.exports = mongoose.model("DonationRequest", donationRequestSchema);
