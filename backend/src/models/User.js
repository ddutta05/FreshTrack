const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { USER_ROLES, USER_STATUS } = require("../utils/constants");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30
    },
    organizationName: {
      type: String,
      trim: true,
      maxlength: 150
    },
    location: {
      type: String,
      trim: true,
      maxlength: 250
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true
    },

    /**
     * GeoJSON Point representing the user's normal/base location.
     * Required for proximity-based donor ↔ NGO recommendations.
     * Optional — existing users without coordinates are fully supported.
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
     * NGO-specific profile fields used for donor ↔ NGO recommendations.
     * These fields are only meaningful for users with role === "ngo".
     * They are not required so that existing records remain compatible.
     */

    /** Food categories this NGO is currently able to accept. */
    acceptedCategories: {
      type: [String]
    },

    /** Maximum distance (km) the NGO can travel to collect a donation. */
    operatingRadiusKm: {
      type: Number,
      min: [0, "operatingRadiusKm must be >= 0"]
    },

    /** Whether the NGO is currently accepting new donations. Defaults to true. */
    isAcceptingDonations: {
      type: Boolean,
      default: true
    },

    /** Free-text description of what the NGO currently needs most urgently. */
    currentNeedDescription: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.index({ geoLocation: "2dsphere" });

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toClient = function toClient() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    organizationName: this.organizationName,
    location: this.location,
    status: this.status,
    geoLocation: this.geoLocation && this.geoLocation.type ? this.geoLocation : undefined,
    acceptedCategories: this.acceptedCategories,
    operatingRadiusKm: this.operatingRadiusKm,
    isAcceptingDonations: this.isAcceptingDonations,
    currentNeedDescription: this.currentNeedDescription,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model("User", userSchema);
