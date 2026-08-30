const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const { connectDb } = require("../config/db");
const User = require("../models/User");
const Donation = require("../models/Donation");
const DonationRequest = require("../models/DonationRequest");
const Notification = require("../models/Notification");
const { USER_ROLES, USER_STATUS, DONATION_STATUS, REQUEST_STATUS, NOTIFICATION_TYPES } = require("../utils/constants");

async function seed() {
  await connectDb();

  await Promise.all([
    Notification.deleteMany({}),
    DonationRequest.deleteMany({}),
    Donation.deleteMany({}),
    User.deleteMany({ email: { $regex: /@freshtrack\.dev$/i } })
  ]);

  const [admin, donorA, donorB, ngoA, ngoB] = await User.create([
    {
      name: "Admin Dev",
      email: "admin@freshtrack.dev",
      password: "Admin123",
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE
    },
    {
      name: "Raj Carter",
      email: "raj@freshtrack.dev",
      password: "Donor123",
      role: USER_ROLES.DONOR,
      phone: "+1 555 111 0000",
      status: USER_STATUS.ACTIVE
    },
    {
      name: "Sarah Lin",
      email: "sarah@freshtrack.dev",
      password: "Donor123",
      role: USER_ROLES.DONOR,
      phone: "+1 555 111 0001",
      status: USER_STATUS.ACTIVE
    },
    {
      name: "Raha Okafor",
      email: "raha@freshtrack.dev",
      password: "Ngo12345",
      role: USER_ROLES.NGO,
      organizationName: "Hope Community Kitchen",
      phone: "+1 555 111 0002",
      status: USER_STATUS.ACTIVE
    },
    {
      name: "Emily Chen",
      email: "emily@freshtrack.dev",
      password: "Ngo12345",
      role: USER_ROLES.NGO,
      organizationName: "City Food Bank",
      phone: "+1 555 111 0003",
      status: USER_STATUS.ACTIVE
    }
  ]);

  const [d1, d2] = await Donation.create([
    {
      foodName: "Vegetable Curry",
      category: "Cooked Food",
      quantity: "20 servings",
      description: "Freshly cooked curry from event surplus.",
      image: "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg",
      location: "Downtown Center",
      availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      donorId: donorA._id,
      status: DONATION_STATUS.AVAILABLE
    },
    {
      foodName: "Bread Loaves",
      category: "Bakery",
      quantity: "30 loaves",
      description: "Same day baked bread.",
      image: "https://images.pexels.com/photos/209194/pexels-photo-209194.jpeg",
      location: "Sunrise Bakery",
      availableUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
      donorId: donorB._id,
      status: DONATION_STATUS.PENDING
    }
  ]);

  const [r1] = await DonationRequest.create([
    {
      donationId: d2._id,
      ngoId: ngoA._id,
      message: "We can distribute to nearby shelters.",
      status: REQUEST_STATUS.PENDING
    }
  ]);

  await Notification.create([
    {
      userId: donorB._id,
      type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
      message: "Hope Community Kitchen requested your donation.",
      donationId: d2._id,
      requestId: r1._id
    }
  ]);

  console.log("Development seed complete");
  console.log("Admin: admin@freshtrack.dev / Admin123");
  console.log("Donor: raj@freshtrack.dev / Donor123");
  console.log("NGO: raha@freshtrack.dev / Ngo12345");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
