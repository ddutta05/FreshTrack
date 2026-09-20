const mongoose = require("mongoose");
const { REQUEST_STATUS, QUANTITY_UNITS } = require("../utils/constants");

const donationOfferSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    ngoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    targetNgoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
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
    quantityValue: {
      type: Number,
      min: [0, "quantityValue must be >= 0"]
    },
    quantityUnit: {
      type: String,
      enum: QUANTITY_UNITS
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    image: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
      index: true
    },
    geoLocation: {
      type: new mongoose.Schema(
        {
          type: {
            type: String,
            enum: ["Point"]
          },
          coordinates: {
            type: [Number]
          }
        },
        { _id: false }
      ),
      default: undefined
    },
    availableUntil: {
      type: Date,
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
    },
    donorCompletedAt: {
      type: Date
    },
    ngoCompletedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

donationOfferSchema.index({ donorId: 1, status: 1, createdAt: -1 });
donationOfferSchema.index({ ngoId: 1, status: 1, createdAt: -1 });
donationOfferSchema.index({ geoLocation: "2dsphere" });

module.exports = mongoose.model("DonationOffer", donationOfferSchema);
