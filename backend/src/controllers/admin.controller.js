const Donation = require("../models/Donation");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { getPagination, toPagination } = require("../utils/pagination");
const { toDonationClient } = require("../services/donation.service");
const { getPlatformStats } = require("../services/admin.service");

const getAdminDonations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [total, items] = await Promise.all([
    Donation.countDocuments(filter),
    Donation.find(filter).populate("donorId", "name").sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  const mapped = items.map(toDonationClient);

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "Admin donations fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "Admin donations fetched", mapped);
});

const getAdminStats = asyncHandler(async (_req, res) => {
  const stats = await getPlatformStats();
  return success(res, 200, "Admin stats fetched", stats);
});

module.exports = {
  getAdminDonations,
  getAdminStats
};
