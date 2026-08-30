const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");
const { registerUser, loginUser } = require("../services/auth.service");

const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  return success(res, 201, "Registration successful", result);
});

const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  return success(res, 200, "Login successful", result);
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  return success(res, 200, "Current user fetched", user.toClient());
});

module.exports = {
  register,
  login,
  me
};
