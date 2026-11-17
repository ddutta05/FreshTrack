const User = require("../models/User");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const { AppError } = require("../utils/errors");
const {
  USER_ROLES,
  USER_STATUS,
  DONATION_STATUS,
  REQUEST_STATUS
} = require("../utils/constants");
const { expireDonationsAndNotify } = require("./donation.service");

/**
 * Calculates distance in kilometers between two GeoJSON [longitude, latitude] points
 * using the Haversine formula.
 */
function calculateHaversineDistance([lng1, lat1], [lng2, lat2]) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function normalizeCategory(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").replace(/ies$/, "y").replace(/s$/, "")
    : "";
}

function acceptsCategory(acceptedCategories, category) {
  const target = normalizeCategory(category);
  if (!target) return true;
  return acceptedCategories.some((accepted) => {
    const normalized = normalizeCategory(accepted);
    return normalized === "any" || normalized === target || normalized.startsWith(target) || target.startsWith(normalized);
  });
}

function categoryMatches(value, category) {
  const normalizedValue = normalizeCategory(value);
  const normalizedCategory = normalizeCategory(category);
  return !normalizedCategory || normalizedValue === normalizedCategory || normalizedValue.startsWith(normalizedCategory) || normalizedCategory.startsWith(normalizedValue);
}

/**
 * Calculates a smoothed reliability score for a donor based on their donation request history.
 * Formula: (completed + 1) / (accepted + 2)  [Laplace smoothing]
 * Defaults to neutral 0.5 when no history exists.
 */
async function calculateDonorReliability(donorId) {
  const donorDonations = await Donation.find({ donorId }).select("_id");
  if (!donorDonations.length) {
    return 0.5;
  }
  const donationIds = donorDonations.map((d) => d._id);

  const [completedCount, acceptedCount] = await Promise.all([
    DonationRequest.countDocuments({
      donationId: { $in: donationIds },
      status: REQUEST_STATUS.COMPLETED
    }),
    DonationRequest.countDocuments({
      donationId: { $in: donationIds },
      status: { $in: [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.COMPLETED] }
    })
  ]);

  const reliability = (completedCount + 1) / (acceptedCount + 2);
  return Number(reliability.toFixed(3));
}

/**
 * Calculates reliability and recent activity metrics for an NGO.
 * Reliability formula: (completed + 1) / (accepted + 2) [Laplace smoothing]
 * Activity formula: min(1, recentRequestsCountIn30Days / 5)
 */
async function calculateNgoMetrics(ngoId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [completedCount, acceptedCount, recentRequestsCount] = await Promise.all([
    DonationRequest.countDocuments({
      ngoId,
      status: REQUEST_STATUS.COMPLETED
    }),
    DonationRequest.countDocuments({
      ngoId,
      status: { $in: [REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.COMPLETED] }
    }),
    DonationRequest.countDocuments({
      ngoId,
      createdAt: { $gte: thirtyDaysAgo }
    })
  ]);

  const reliability = (completedCount + 1) / (acceptedCount + 2);
  const activity = Math.min(1, recentRequestsCount / 5);

  return {
    reliability: Number(reliability.toFixed(3)),
    activity: Number(activity.toFixed(3))
  };
}

/**
 * Find suitable nearby donations for an NGO.
 *
 * @param {Object} params
 * @param {string} params.ngoId - User ID of the requesting NGO
 * @param {number} [params.maxDistanceKm] - Optional search radius in km (max 50)
 * @returns {Promise<Array<Object>>} Top 5 scored donation recommendations
 */
async function findDonationsForNgo({
  ngoId,
  category,
  maxDistanceKm,
  sortByDistance = false,
  distanceSortOrder = "ascending"
}) {
  await expireDonationsAndNotify();

  const ngo = await User.findById(ngoId);
  if (!ngo) {
    throw new AppError("NGO not found", 404, "USER_NOT_FOUND");
  }

  if (ngo.role !== USER_ROLES.NGO) {
    throw new AppError("User is not an NGO", 403, "FORBIDDEN");
  }

  if (ngo.status === USER_STATUS.DISABLED) {
    throw new AppError("Account is disabled", 403, "ACCOUNT_DISABLED");
  }

  if (
    !ngo.geoLocation ||
    !Array.isArray(ngo.geoLocation.coordinates) ||
    ngo.geoLocation.coordinates.length !== 2
  ) {
    throw new AppError(
      "NGO location is not set. Please update your profile with your location to get recommendations.",
      400,
      "LOCATION_REQUIRED"
    );
  }

  const searchRadiusKm = maxDistanceKm === undefined ? undefined : Number(maxDistanceKm);

  const now = new Date();

  // Find donations within search radius with matching category, valid status, and future availableUntil
  const candidates = await Donation.find({
    status: { $in: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.PENDING] },
    availableUntil: { $gt: now },
    $or: [{ targetNgoId: { $exists: false } }, { targetNgoId: ngoId }],
    geoLocation: {
      $near: {
        $geometry: { type: "Point", coordinates: ngo.geoLocation.coordinates },
        ...(searchRadiusKm !== undefined ? { $maxDistance: searchRadiusKm * 1000 } : {})
      }
    }
  }).populate("donorId", "name phone status");

  const scoredDonations = [];

  for (const donation of candidates) {
    if (!donation.geoLocation || !Array.isArray(donation.geoLocation.coordinates)) {
      continue;
    }

    if (category && !categoryMatches(donation.category, category)) continue;

    const distanceKm = calculateHaversineDistance(
      ngo.geoLocation.coordinates,
      donation.geoLocation.coordinates
    );

    // Filter out candidates beyond the radius
    if (searchRadiusKm !== undefined && distanceKm > searchRadiusKm) {
      continue;
    }

    // Normalized scores (0 to 1)
    const distanceScore = searchRadiusKm === undefined
      ? 1 / (1 + distanceKm)
      : Math.max(0, 1 - distanceKm / searchRadiusKm);

    const hoursUntilExpiry = Math.max(
      0,
      (new Date(donation.availableUntil).getTime() - now.getTime()) / (1000 * 60 * 60)
    );
    const expiryUrgency = hoursUntilExpiry <= 72 ? Math.max(0, (72 - hoursUntilExpiry) / 72) : 0;

    const donorUserId = donation.donorId?._id ? donation.donorId._id.toString() : donation.donorId.toString();
    const reliabilityScore = await calculateDonorReliability(donorUserId);

    // Normalized weights (sum to 1.0): distance 0.50, expiry urgency 0.30, donor reliability 0.20
    const rawScore =
      0.5 * distanceScore +
      0.3 * expiryUrgency +
      0.2 * reliabilityScore;

    const score = Number(rawScore.toFixed(3));

    scoredDonations.push({
      donationId: donation._id.toString(),
      foodName: donation.foodName,
      category: donation.category,
      quantity: donation.quantity,
      quantityValue: donation.quantityValue,
      quantityUnit: donation.quantityUnit,
      location: donation.location,
      availableUntil: donation.availableUntil,
      donorId: donorUserId,
      donorName: donation.donorId?.name || "Unknown",
      distanceKm,
      score,
      scoreBreakdown: {
        distanceScore: Number(distanceScore.toFixed(3)),
        expiryUrgency: Number(expiryUrgency.toFixed(3)),
        reliabilityScore: Number(reliabilityScore.toFixed(3))
      }
    });
  }

  if (sortByDistance) {
    scoredDonations.sort((a, b) => {
      const distanceDifference = distanceSortOrder === "descending"
        ? b.distanceKm - a.distanceKm
        : a.distanceKm - b.distanceKm;
      return distanceDifference || a.donationId.localeCompare(b.donationId);
    });
  } else {
    scoredDonations.sort((a, b) => b.score - a.score);
  }
  return scoredDonations.slice(0, 5);
}

/**
 * Find suitable nearby NGOs for a donor.
 *
 * @param {Object} params
 * @param {string} params.donorId - User ID of the donor
 * @param {string} [params.category] - Food category
 * @param {string} [params.donationId] - Optional specific donation ID
 * @param {number} [params.maxDistanceKm] - Optional search radius in km (max 50)
 * @returns {Promise<Array<Object>>} Top 5 scored NGO recommendations
 */
async function findNgosForDonor({
  donorId,
  category,
  donationId,
  maxDistanceKm,
  sortByDistance = false,
  distanceSortOrder = "ascending"
}) {
  const donor = await User.findById(donorId);
  if (!donor) {
    throw new AppError("Donor not found", 404, "USER_NOT_FOUND");
  }

  if (donor.role !== USER_ROLES.DONOR) {
    throw new AppError("User is not a donor", 403, "FORBIDDEN");
  }

  if (donor.status === USER_STATUS.DISABLED) {
    throw new AppError("Account is disabled", 403, "ACCOUNT_DISABLED");
  }

  let targetCategory = category;
  let centerCoordinates = donor.geoLocation?.coordinates;

  if (donationId) {
    const donation = await Donation.findById(donationId);
    if (!donation) {
      throw new AppError("Donation not found", 404, "DONATION_NOT_FOUND");
    }
    if (donation.donorId.toString() !== donorId) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
    targetCategory = donation.category;
    if (donation.geoLocation?.coordinates && donation.geoLocation.coordinates.length === 2) {
      centerCoordinates = donation.geoLocation.coordinates;
    }
  }

  if (!centerCoordinates || !Array.isArray(centerCoordinates) || centerCoordinates.length !== 2) {
    throw new AppError(
      "Donor location is not set. Please update your profile or specify a donation location.",
      400,
      "LOCATION_REQUIRED"
    );
  }

  const searchRadiusKm = maxDistanceKm === undefined ? undefined : Number(maxDistanceKm);

  // Query active NGOs within search radius that accept the given category and are accepting donations
  const candidateNgos = await User.find({
    role: USER_ROLES.NGO,
    status: USER_STATUS.ACTIVE,
    isAcceptingDonations: { $ne: false },
    geoLocation: {
      $near: {
        $geometry: { type: "Point", coordinates: centerCoordinates },
        ...(searchRadiusKm !== undefined ? { $maxDistance: searchRadiusKm * 1000 } : {})
      }
    }
  });

  const scoredNgos = [];

  for (const ngo of candidateNgos) {
    if (!ngo.geoLocation || !Array.isArray(ngo.geoLocation.coordinates)) {
      continue;
    }

    const distanceKm = calculateHaversineDistance(centerCoordinates, ngo.geoLocation.coordinates);

    // Must be within the donor's search radius
    if (searchRadiusKm !== undefined && distanceKm > searchRadiusKm) {
      continue;
    }

    if (targetCategory && !(normalizeCategory(targetCategory) === "any" || acceptsCategory(ngo.acceptedCategories || [], targetCategory))) {
      continue;
    }

    if (ngo.operatingRadiusKm !== undefined && ngo.operatingRadiusKm !== null && distanceKm > ngo.operatingRadiusKm) {
      continue;
    }

    const distanceScore = searchRadiusKm === undefined
      ? 1 / (1 + distanceKm)
      : Math.max(0, 1 - distanceKm / searchRadiusKm);
    const { reliability: reliabilityScore, activity: activityScore } = await calculateNgoMetrics(ngo._id);

    // Normalized weights (sum to 1.0): distance 0.60, NGO reliability 0.25, activity 0.15
    const rawScore =
      0.6 * distanceScore +
      0.25 * reliabilityScore +
      0.15 * activityScore;

    const score = Number(rawScore.toFixed(3));

    scoredNgos.push({
      ngoId: ngo._id.toString(),
      organizationName: ngo.organizationName || ngo.name,
      name: ngo.name,
      location: ngo.location || "",
      acceptedCategories: ngo.acceptedCategories || [],
      operatingRadiusKm: ngo.operatingRadiusKm,
      isAcceptingDonations: ngo.isAcceptingDonations !== false,
      currentNeedDescription: ngo.currentNeedDescription || "",
      distanceKm,
      score,
      scoreBreakdown: {
        distanceScore: Number(distanceScore.toFixed(3)),
        reliabilityScore: Number(reliabilityScore.toFixed(3)),
        activityScore: Number(activityScore.toFixed(3))
      }
    });
  }

  if (sortByDistance) {
    scoredNgos.sort((a, b) => {
      const distanceDifference = distanceSortOrder === "descending"
        ? b.distanceKm - a.distanceKm
        : a.distanceKm - b.distanceKm;
      return distanceDifference || a.ngoId.localeCompare(b.ngoId);
    });
  } else {
    scoredNgos.sort((a, b) => b.score - a.score);
  }
  return scoredNgos.slice(0, 5);
}

async function browseNgosForDonor({ donorId, category, maxDistanceKm }) {
  const donor = await User.findById(donorId).select("geoLocation role status");
  if (!donor || donor.role !== USER_ROLES.DONOR) throw new AppError("User is not a donor", 403, "FORBIDDEN");
  if (donor.status === USER_STATUS.DISABLED) throw new AppError("Account is disabled", 403, "ACCOUNT_DISABLED");

  const searchRadiusKm = maxDistanceKm === undefined ? undefined : Number(maxDistanceKm);
  const query = {
    role: USER_ROLES.NGO,
    status: USER_STATUS.ACTIVE,
    isAcceptingDonations: { $ne: false }
  };
  if (donor.geoLocation?.coordinates) {
    query.geoLocation = {
      $near: {
        $geometry: { type: "Point", coordinates: donor.geoLocation.coordinates },
        ...(searchRadiusKm !== undefined ? { $maxDistance: searchRadiusKm * 1000 } : {})
      }
    };
  }

  const ngos = await User.find(query);
  return ngos
    .filter((ngo) => !category || normalizeCategory(category) === "any" || acceptsCategory(ngo.acceptedCategories || [], category))
    .map((ngo) => {
      const distanceKm = donor.geoLocation?.coordinates && ngo.geoLocation?.coordinates
        ? calculateHaversineDistance(donor.geoLocation.coordinates, ngo.geoLocation.coordinates)
        : undefined;
      return {
        ngoId: ngo._id.toString(),
        name: ngo.name,
        organizationName: ngo.organizationName || ngo.name,
        location: ngo.location || "",
        acceptedCategories: ngo.acceptedCategories || [],
        isAcceptingDonations: ngo.isAcceptingDonations !== false,
        currentNeedDescription: ngo.currentNeedDescription || "",
        operatingRadiusKm: ngo.operatingRadiusKm,
        ...(distanceKm !== undefined ? { distanceKm } : {})
      };
    })
    .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
}

module.exports = {
  findDonationsForNgo,
  findNgosForDonor,
  browseNgosForDonor,
  calculateHaversineDistance,
  calculateDonorReliability,
  calculateNgoMetrics,
  normalizeCategory,
  acceptsCategory,
  categoryMatches
};
