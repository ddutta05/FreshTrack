const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const { connectDb } = require("../config/db");
const User = require("../models/User");
const { USER_ROLES, USER_STATUS } = require("../utils/constants");

async function seedAdmin() {
  const name = process.env.ADMIN_NAME;
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  await connectDb();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Admin already exists");
    process.exit(0);
  }

  await User.create({
    name,
    email,
    password,
    role: USER_ROLES.ADMIN,
    status: USER_STATUS.ACTIVE
  });

  console.log("Admin seeded successfully");
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error("Failed seeding admin:", error.message);
  process.exit(1);
});
