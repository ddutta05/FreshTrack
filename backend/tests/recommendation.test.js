const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Donation = require("../src/models/Donation");
const DonationRequest = require("../src/models/DonationRequest");
const {
  USER_ROLES,
  USER_STATUS,
  DONATION_STATUS,
  REQUEST_STATUS
} = require("../src/utils/constants");
const { createUser, authHeaderFor } = require("./helpers/factories");

describe("Phase 2 — Recommendation Engine", () => {
  // Center: Downtown Bangalore [77.5946, 12.9716]
  const bangaloreCenter = [77.5946, 12.9716];
  // ~3 km away in Indiranagar: [77.6408, 12.9784]
  const bangaloreNear = [77.6408, 12.9784];
  // ~12 km away in Electronic City: [77.6762, 12.8452]
  const bangaloreMedium = [77.6762, 12.8452];
  // ~35 km away in Hosur: [77.8253, 12.7409]
  const bangaloreFar = [77.8253, 12.7409];
  // ~290 km away in Chennai: [80.2707, 13.0827]
  const chennaiVeryFar = [80.2707, 13.0827];

  beforeAll(async () => {
    await Promise.all([User.init(), Donation.init(), DonationRequest.init()]);
  });

  // ──────────────────────────────────────────────
  // NGO -> DONATIONS RECOMMENDATIONS
  // ──────────────────────────────────────────────
  describe("GET /api/recommendations/donations (NGO -> Donations)", () => {
    let ngo;
    let donor;

    beforeEach(async () => {
      donor = await createUser({
        role: USER_ROLES.DONOR,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });
      donor.geoLocation = { type: "Point", coordinates: bangaloreNear };
      await donor.save();

      ngo = await createUser({
        role: USER_ROLES.NGO,
        organizationName: "City Relief NGO",
        acceptedCategories: ["Cooked Food", "Rice", "Bakery"],
        operatingRadiusKm: 25
      });
      ngo.geoLocation = { type: "Point", coordinates: bangaloreCenter };
      ngo.acceptedCategories = ["Cooked Food", "Rice", "Bakery"];
      ngo.operatingRadiusKm = 25;
      await ngo.save();
    });

    test("1. Nearby compatible donation is returned", async () => {
      await Donation.create({
        foodName: "Warm Rice Meals",
        category: "Rice",
        quantity: "30 servings",
        quantityValue: 30,
        quantityUnit: "servings",
        description: "Fresh rice",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].foodName).toBe("Warm Rice Meals");
      expect(res.body.data[0].category).toBe("Rice");
      expect(res.body.data[0].distanceKm).toBeGreaterThan(0);
      expect(res.body.data[0].distanceKm).toBeLessThan(10);
      expect(res.body.data[0].score).toBeGreaterThan(0);
      expect(res.body.data[0].scoreBreakdown).toBeDefined();
      expect(res.body.data[0].scoreBreakdown.distanceScore).toBeDefined();
      expect(res.body.data[0].scoreBreakdown.expiryUrgency).toBeDefined();
      expect(res.body.data[0].scoreBreakdown.reliabilityScore).toBeDefined();
    });

    test("2. Far donation beyond search radius is excluded", async () => {
      // Create donation 290 km away in Chennai
      await Donation.create({
        foodName: "Chennai Food",
        category: "Cooked Food",
        quantity: "50 servings",
        description: "Very far food",
        location: "Chennai",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: chennaiVeryFar }
      });

      const res = await request(app)
        .get("/api/recommendations/donations?maxDistanceKm=25")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test("3. Expired donation is excluded", async () => {
      await Donation.create({
        foodName: "Expired Curry",
        category: "Cooked Food",
        quantity: "10 servings",
        description: "Old food",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test("4. Incompatible category is excluded", async () => {
      // NGO only accepts Cooked Food, Rice, Bakery
      await Donation.create({
        foodName: "Fresh Apples",
        category: "Fruits", // not accepted by this NGO
        quantity: "10 kg",
        description: "Apples",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test("5. Donation without geoLocation is excluded", async () => {
      await Donation.create({
        foodName: "No Geo Food",
        category: "Rice",
        quantity: "20 kg",
        description: "No coordinates",
        location: "Downtown",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE
        // no geoLocation
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test("6. NGO without geoLocation gets a 400 error (LOCATION_REQUIRED)", async () => {
      const ngoNoLoc = await createUser({
        role: USER_ROLES.NGO,
        organizationName: "No Loc NGO",
        acceptedCategories: ["Rice"]
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngoNoLoc));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("LOCATION_REQUIRED");
    });

    test("7. Results are sorted by score descending (closer and expiring sooner scored higher)", async () => {
      // Donation 1: ~3km away, expires in 4 hours (very urgent, very close)
      await Donation.create({
        foodName: "Urgent Close Food",
        category: "Cooked Food",
        quantity: "20 servings",
        description: "Hot meals",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 4 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      // Donation 2: ~12km away, expires in 48 hours
      await Donation.create({
        foodName: "Medium Dist Food",
        category: "Cooked Food",
        quantity: "15 servings",
        description: "Fresh meals",
        location: "Electronic City",
        availableUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreMedium }
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].foodName).toBe("Urgent Close Food");
      expect(res.body.data[1].foodName).toBe("Medium Dist Food");
      expect(res.body.data[0].score).toBeGreaterThan(res.body.data[1].score);
    });

    test("8. Maximum 5 results are returned when more candidates exist", async () => {
      for (let i = 1; i <= 8; i++) {
        await Donation.create({
          foodName: `Food Item ${i}`,
          category: "Cooked Food",
          quantity: `${i * 5} servings`,
          description: `Description ${i}`,
          location: "Location",
          availableUntil: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
          donorId: donor._id,
          status: DONATION_STATUS.AVAILABLE,
          geoLocation: { type: "Point", coordinates: bangaloreNear }
        });
      }

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
    });

    test("9. Pending status donations are recommendable, while accepted/completed/expired are excluded", async () => {
      // Pending donation (has an open request but not yet accepted by donor)
      await Donation.create({
        foodName: "Pending Food",
        category: "Rice",
        quantity: "10 kg",
        description: "Pending request exists",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.PENDING,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      // Accepted donation (locked to a specific NGO)
      await Donation.create({
        foodName: "Accepted Food",
        category: "Rice",
        quantity: "10 kg",
        description: "Already accepted",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.ACCEPTED,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      // Completed donation
      await Donation.create({
        foodName: "Completed Food",
        category: "Rice",
        quantity: "10 kg",
        description: "Completed",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.COMPLETED,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].foodName).toBe("Pending Food");
    });

    test("Old records without quantityValue/quantityUnit are compatible", async () => {
      await Donation.create({
        foodName: "Legacy Food",
        category: "Rice",
        quantity: "20 kg", // plain string only
        description: "Old style",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].quantity).toBe("20 kg");
      expect(res.body.data[0].quantityValue).toBeUndefined();
      expect(res.body.data[0].quantityUnit).toBeUndefined();
    });

    test("Donor reliability is factored into recommendation score", async () => {
      // Create a donor with high reliability history
      const reliableDonor = await createUser({
        role: USER_ROLES.DONOR,
        name: "Reliable Donor"
      });
      reliableDonor.geoLocation = { type: "Point", coordinates: bangaloreNear };
      await reliableDonor.save();

      // Create previous completed donations for reliableDonor
      const pastDonation = await Donation.create({
        foodName: "Past Donation",
        category: "Cooked Food",
        quantity: "10 servings",
        description: "Past",
        location: "Downtown",
        availableUntil: new Date(Date.now() + 100000),
        donorId: reliableDonor._id,
        status: DONATION_STATUS.COMPLETED
      });

      await DonationRequest.create({
        donationId: pastDonation._id,
        ngoId: ngo._id,
        status: REQUEST_STATUS.COMPLETED
      });

      // Now create current donation
      await Donation.create({
        foodName: "Reliable Food",
        category: "Cooked Food",
        quantity: "10 servings",
        description: "Reliable food",
        location: "Indiranagar",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: reliableDonor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreNear }
      });

      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      // reliability = (1 + 1) / (1 + 2) = 2/3 = 0.667 (higher than default 0.5)
      expect(res.body.data[0].scoreBreakdown.reliabilityScore).toBe(0.667);
    });
  });

  // ──────────────────────────────────────────────
  // DONOR -> NGO RECOMMENDATIONS
  // ──────────────────────────────────────────────
  describe("GET /api/recommendations/ngos (Donor -> NGOs)", () => {
    let donor;
    let ngoNear;

    beforeEach(async () => {
      donor = await createUser({
        role: USER_ROLES.DONOR,
        name: "Main Donor"
      });
      donor.geoLocation = { type: "Point", coordinates: bangaloreCenter };
      await donor.save();

      ngoNear = await createUser({
        role: USER_ROLES.NGO,
        organizationName: "Near Community Kitchen",
        acceptedCategories: ["Cooked Food", "Rice"],
        operatingRadiusKm: 25,
        isAcceptingDonations: true
      });
      ngoNear.geoLocation = { type: "Point", coordinates: bangaloreNear };
      ngoNear.acceptedCategories = ["Cooked Food", "Rice"];
      ngoNear.operatingRadiusKm = 25;
      ngoNear.isAcceptingDonations = true;
      await ngoNear.save();
    });

    test("1. Nearby matching NGO is returned", async () => {
      const res = await request(app)
        .get("/api/recommendations/ngos?category=Cooked%20Food")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].organizationName).toBe("Near Community Kitchen");
      expect(res.body.data[0].distanceKm).toBeGreaterThan(0);
      expect(res.body.data[0].distanceKm).toBeLessThan(10);
      expect(res.body.data[0].score).toBeGreaterThan(0);
      expect(res.body.data[0].scoreBreakdown).toBeDefined();
      expect(res.body.data[0].scoreBreakdown.distanceScore).toBeDefined();
      expect(res.body.data[0].scoreBreakdown.reliabilityScore).toBeDefined();
      expect(res.body.data[0].scoreBreakdown.activityScore).toBeDefined();
    });

    test("2. Non-matching category NGO is excluded", async () => {
      // ngoNear only accepts Cooked Food and Rice
      const res = await request(app)
        .get("/api/recommendations/ngos?category=Bakery")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test("3. NGO not accepting donations is excluded", async () => {
      ngoNear.isAcceptingDonations = false;
      await ngoNear.save();

      const res = await request(app)
        .get("/api/recommendations/ngos?category=Cooked%20Food")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test("4. NGO beyond its operating radius is excluded", async () => {
      // NGO is ~35km away in Hosur with an operating radius of only 15km
      const ngoSmallRadius = await createUser({
        role: USER_ROLES.NGO,
        organizationName: "Small Radius NGO",
        acceptedCategories: ["Cooked Food"],
        operatingRadiusKm: 15, // cannot travel 35 km
        isAcceptingDonations: true
      });
      ngoSmallRadius.geoLocation = { type: "Point", coordinates: bangaloreFar };
      ngoSmallRadius.acceptedCategories = ["Cooked Food"];
      ngoSmallRadius.operatingRadiusKm = 15;
      await ngoSmallRadius.save();

      const res = await request(app)
        .get("/api/recommendations/ngos?category=Cooked%20Food&maxDistanceKm=50")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      // Only ngoNear should be returned; ngoSmallRadius cannot service donor's location
      const returnedIds = res.body.data.map((n) => n.ngoId);
      expect(returnedIds).not.toContain(ngoSmallRadius._id.toString());
    });

    test("5. NGO without geoLocation is excluded", async () => {
      const ngoNoLoc = await createUser({
        role: USER_ROLES.NGO,
        organizationName: "No Loc NGO",
        acceptedCategories: ["Cooked Food"],
        isAcceptingDonations: true
      });

      const res = await request(app)
        .get("/api/recommendations/ngos?category=Cooked%20Food")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.map((n) => n.ngoId);
      expect(returnedIds).not.toContain(ngoNoLoc._id.toString());
    });

    test("6. Donor without geoLocation gets a 400 error (LOCATION_REQUIRED)", async () => {
      const donorNoLoc = await createUser({
        role: USER_ROLES.DONOR,
        name: "No Loc Donor"
      });

      const res = await request(app)
        .get("/api/recommendations/ngos?category=Cooked%20Food")
        .set("Authorization", authHeaderFor(donorNoLoc));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("LOCATION_REQUIRED");
    });

    test("7. Results are sorted by score descending (closer NGOs scored higher)", async () => {
      // NGO 2: ~12km away
      const ngoMedium = await createUser({
        role: USER_ROLES.NGO,
        organizationName: "Medium Dist NGO",
        acceptedCategories: ["Cooked Food"],
        operatingRadiusKm: 30,
        isAcceptingDonations: true
      });
      ngoMedium.geoLocation = { type: "Point", coordinates: bangaloreMedium };
      ngoMedium.acceptedCategories = ["Cooked Food"];
      ngoMedium.operatingRadiusKm = 30;
      await ngoMedium.save();

      const res = await request(app)
        .get("/api/recommendations/ngos?category=Cooked%20Food")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].organizationName).toBe("Near Community Kitchen");
      expect(res.body.data[1].organizationName).toBe("Medium Dist NGO");
      expect(res.body.data[0].score).toBeGreaterThan(res.body.data[1].score);
    });

    test("8. Maximum 5 results are returned when more candidates exist", async () => {
      for (let i = 1; i <= 7; i++) {
        const ngo = await createUser({
          role: USER_ROLES.NGO,
          organizationName: `NGO Hub ${i}`,
          acceptedCategories: ["Cooked Food"],
          operatingRadiusKm: 30,
          isAcceptingDonations: true
        });
        ngo.geoLocation = { type: "Point", coordinates: bangaloreNear };
        ngo.acceptedCategories = ["Cooked Food"];
        ngo.operatingRadiusKm = 30;
        await ngo.save();
      }

      const res = await request(app)
        .get("/api/recommendations/ngos?category=Cooked%20Food")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
    });

    test("Recommendation with specific donationId uses donation's category and location", async () => {
      // Create donation with specific location in Electronic City
      const donation = await Donation.create({
        foodName: "Special Rice",
        category: "Rice",
        quantity: "15 kg",
        description: "Special donation",
        location: "Electronic City",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreMedium }
      });

      const res = await request(app)
        .get(`/api/recommendations/ngos?donationId=${donation._id}`)
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].organizationName).toBe("Near Community Kitchen");
    });

    test("Donor A cannot use Donor B's donationId for NGO recommendations (403 Forbidden)", async () => {
      const donorB = await createUser({
        role: USER_ROLES.DONOR,
        name: "Donor B"
      });
      donorB.geoLocation = { type: "Point", coordinates: bangaloreCenter };
      await donorB.save();

      const donationOfB = await Donation.create({
        foodName: "B's Rice",
        category: "Rice",
        quantity: "10 kg",
        description: "B's donation",
        location: "Downtown",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        donorId: donorB._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: bangaloreCenter }
      });

      // Donor (A) attempts to request recommendations using B's donationId
      const res = await request(app)
        .get(`/api/recommendations/ngos?donationId=${donationOfB._id}`)
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    test("custom and Any NGO categories match without an arbitrary radius", async () => {
      const customNgo = await createUser({
        role: USER_ROLES.NGO,
        organizationName: "Chocolate NGO",
        acceptedCategories: ["Chocolates"]
      });
      customNgo.geoLocation = { type: "Point", coordinates: bangaloreFar };
      customNgo.acceptedCategories = ["Chocolates"];
      customNgo.operatingRadiusKm = undefined;
      await customNgo.save();

      const anyNgo = await createUser({ role: USER_ROLES.NGO, organizationName: "Any Food NGO", acceptedCategories: ["Any"] });
      anyNgo.geoLocation = { type: "Point", coordinates: bangaloreNear };
      anyNgo.acceptedCategories = ["Any"];
      await anyNgo.save();

      const res = await request(app)
        .get("/api/recommendations/ngos?category=Chocolates")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(200);
      expect(res.body.data.map((item) => item.organizationName)).toEqual(expect.arrayContaining(["Chocolate NGO", "Any Food NGO"]));
    });
  });

  // ──────────────────────────────────────────────
  // ROLE ACCESS & AUTHENTICATION
  // ──────────────────────────────────────────────
  describe("Role Authorization", () => {
    test("Donor cannot access NGO donation recommendations endpoint", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .get("/api/recommendations/donations")
        .set("Authorization", authHeaderFor(donor));

      expect(res.status).toBe(403);
    });

    test("NGO cannot access donor NGO recommendations endpoint", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const res = await request(app)
        .get("/api/recommendations/ngos?category=Rice")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(403);
    });

    test("Unauthenticated requests are rejected", async () => {
      const res1 = await request(app).get("/api/recommendations/donations");
      expect(res1.status).toBe(401);

      const res2 = await request(app).get("/api/recommendations/ngos?category=Rice");
      expect(res2.status).toBe(401);
    });
  });
});
