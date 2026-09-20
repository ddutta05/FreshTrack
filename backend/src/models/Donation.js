const mongoose = require("mongoose");
const { DONATION_STATUS, QUANTITY_UNITS } = require("../utils/constants");

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
    targetNgoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    status: {
      type: String,
      enum: Object.values(DONATION_STATUS),
      default: DONATION_STATUS.AVAILABLE,
      index: true
    },

    /**
     * GeoJSON Point representing the ACTUAL pickup location for this donation.
     * May be copied from the donor's User.geoLocation at creation time,
     * or overridden for a specific donation.
     * Optional — existing donations without coordinates remain valid.
     * coordinates: [longitude, latitude]  (GeoJSON / MongoDB 2dsphere order)
     */
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

    /**
     * Structured numeric quantity — complements the existing free-text `quantity`
     * field which is kept for display and backward compatibility.
     */
    quantityValue: {
      type: Number,
      min: [0, "quantityValue must be >= 0"]
    },
    quantityUnit: {
      type: String,
      enum: QUANTITY_UNITS
    }
  },
  { timestamps: true }
);

donationSchema.index({ foodName: "text", location: "text", category: "text" });
donationSchema.index({ donorId: 1, status: 1, createdAt: -1 });
donationSchema.index({ geoLocation: "2dsphere" });

module.exports = mongoose.model("Donation", donationSchema);
