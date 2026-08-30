const User = require("../../src/models/User");
const Donation = require("../../src/models/Donation");
const generateToken = require("../../src/utils/generateToken");
const { USER_ROLES, USER_STATUS, DONATION_STATUS } = require("../../src/utils/constants");

let userCounter = 1;

async function createUser(overrides = {}) {
  const idx = userCounter++;
  const role = overrides.role || USER_ROLES.DONOR;
  const user = await User.create({
    name: overrides.name || `User ${idx}`,
    email: overrides.email || `user${idx}@test.dev`,
    password: overrides.password || "Pass1234",
    role,
    phone: overrides.phone,
    organizationName: role === USER_ROLES.NGO ? overrides.organizationName || `NGO ${idx}` : undefined,
    status: overrides.status || USER_STATUS.ACTIVE
  });
  return user;
}

function authHeaderFor(user) {
  const token = generateToken({ id: user._id.toString(), role: user.role });
  return `Bearer ${token}`;
}

async function createDonationForUser(user, overrides = {}) {
  return Donation.create({
    foodName: overrides.foodName || "Vegetable Curry",
    category: overrides.category || "Cooked Food",
    quantity: overrides.quantity || "10 servings",
    description: overrides.description || "Fresh and ready",
    image: overrides.image || "https://example.com/food.jpg",
    location: overrides.location || "Downtown",
    availableUntil: overrides.availableUntil || new Date(Date.now() + 24 * 60 * 60 * 1000),
    donorId: user._id,
    status: overrides.status || DONATION_STATUS.AVAILABLE
  });
}

module.exports = {
  createUser,
  authHeaderFor,
  createDonationForUser
};
