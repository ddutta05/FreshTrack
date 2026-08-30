const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { AppError } = require("../utils/errors");
const { USER_ROLES, USER_STATUS } = require("../utils/constants");

async function registerUser(payload) {
  if (payload.role === USER_ROLES.ADMIN) {
    throw new AppError("Admin registration is not allowed", 403, "ADMIN_REGISTRATION_FORBIDDEN");
  }

  if (payload.role === USER_ROLES.NGO && !payload.organizationName) {
    throw new AppError("Organization name is required for NGO accounts", 422, "VALIDATION_ERROR");
  }

  const existing = await User.findOne({ email: payload.email.toLowerCase() });
  if (existing) {
    throw new AppError("An account with this email already exists.", 409, "EMAIL_EXISTS");
  }

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    phone: payload.phone,
    organizationName: payload.role === USER_ROLES.NGO ? payload.organizationName : undefined,
    status: USER_STATUS.ACTIVE
  });

  const token = generateToken(user);
  return { user: user.toClient(), token };
}

async function loginUser({ email, password, role }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  if (role && user.role !== role) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  if (user.status === USER_STATUS.DISABLED) {
    throw new AppError("Account is disabled", 403, "ACCOUNT_DISABLED");
  }

  const token = generateToken(user);
  return { user: user.toClient(), token };
}

module.exports = {
  registerUser,
  loginUser
};
