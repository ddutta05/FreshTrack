const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { success, paginated } = require("../utils/apiResponse");
const { AppError } = require("../utils/errors");
const { getPagination, toPagination } = require("../utils/pagination");
const { USER_ROLES, USER_STATUS } = require("../utils/constants");

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  return success(res, 200, "Profile fetched", user.toClient());
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (user.role === USER_ROLES.NGO && req.body.organizationName !== undefined) {
    user.organizationName = req.body.organizationName;
  }

  await user.save();
  return success(res, 200, "Profile updated successfully", user.toClient());
});

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } }
    ];
  }

  const [total, items] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  const mapped = items.map((u) => u.toClient());

  if (req.query.page || req.query.limit) {
    return paginated(res, 200, "Users fetched", mapped, toPagination(page, limit, total));
  }

  return success(res, 200, "Users fetched", mapped);
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  return success(res, 200, "User fetched", user.toClient());
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const isAdmin = req.user.role === USER_ROLES.ADMIN;
  const isSelf = req.user.id === user._id.toString();
  if (!isAdmin && !isSelf) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.organizationName !== undefined && user.role === USER_ROLES.NGO) {
    user.organizationName = req.body.organizationName;
  }

  if (isAdmin && req.body.role && req.body.role !== USER_ROLES.ADMIN) {
    user.role = req.body.role;
  }

  if (isAdmin && req.body.status && Object.values(USER_STATUS).includes(req.body.status)) {
    user.status = req.body.status;
  }

  await user.save();
  return success(res, 200, "User updated", user.toClient());
});

const disableUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  if (user.role === USER_ROLES.ADMIN) {
    throw new AppError("Admin user cannot be disabled from this endpoint", 400, "ADMIN_DISABLE_FORBIDDEN");
  }

  user.status = USER_STATUS.DISABLED;
  await user.save();

  return success(res, 200, "User status updated", user.toClient());
});

const enableUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  user.status = USER_STATUS.ACTIVE;
  await user.save();
  return success(res, 200, "User enabled", user.toClient());
});

module.exports = {
  getProfile,
  updateProfile,
  listUsers,
  getUserById,
  updateUser,
  disableUser,
  enableUser
};
