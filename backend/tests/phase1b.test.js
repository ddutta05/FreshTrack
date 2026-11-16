const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Donation = require("../src/models/Donation");
const { USER_ROLES, USER_STATUS, DONATION_STATUS, QUANTITY_UNITS } = require("../src/utils/constants");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");

describe("Phase 1B — API Validation & Location Defaulting", () => {
  // ──────────────────────────────────────────────
  // PROFILE TESTS
  // ──────────────────────────────────────────────

  describe("Profile Update (PUT /api/users/me)", () => {
    test("1. Donor can update their own geoLocation", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [77.5946, 12.9716]
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.geoLocation).toEqual({
        type: "Point",
        coordinates: [77.5946, 12.9716]
      });

      const updated = await User.findById(donor._id);
      expect(updated.geoLocation.type).toBe("Point");
      expect(updated.geoLocation.coordinates).toEqual([77.5946, 12.9716]);
    });

    test("2. NGO can update their own geoLocation", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(ngo))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [80.2707, 13.0827]
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.data.geoLocation).toEqual({
        type: "Point",
        coordinates: [80.2707, 13.0827]
      });
    });

    test("3. NGO can update acceptedCategories", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(ngo))
        .send({
          acceptedCategories: ["Cooked Food", "Rice", "Bakery"]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.acceptedCategories).toEqual(["Cooked Food", "Rice", "Bakery"]);
    });

    test("4. NGO can update operatingRadiusKm", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(ngo))
        .send({
          operatingRadiusKm: 25.5
        });

      expect(res.status).toBe(200);
      expect(res.body.data.operatingRadiusKm).toBe(25.5);
    });

    test("5. NGO can update isAcceptingDonations", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(ngo))
        .send({
          isAcceptingDonations: false
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isAcceptingDonations).toBe(false);
    });

    test("6. NGO can update currentNeedDescription", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(ngo))
        .send({
          currentNeedDescription: "Need 100 boxes of meals today"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.currentNeedDescription).toBe("Need 100 boxes of meals today");
    });

    test("NGO can clear currentNeedDescription", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      ngo.currentNeedDescription = "Need 100 boxes of meals today";
      await ngo.save();

      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(ngo))
        .send({ currentNeedDescription: "" });

      expect(res.status).toBe(200);
      expect(res.body.data.currentNeedDescription).toBe("");
      expect((await User.findById(ngo._id)).currentNeedDescription).toBe("");
    });

    test("NGO can clear their location", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO });
      ngo.location = "Test City";
      await ngo.save();

      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(ngo))
        .send({ location: "" });

      expect(res.status).toBe(200);
      expect(res.body.data.location).toBe("");
      expect((await User.findById(ngo._id)).location).toBe("");
    });

    test("7. Invalid GeoJSON type is rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "LineString",
            coordinates: [[0, 0], [1, 1]]
          }
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("8. Coordinates with wrong length are rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });

      // 1 coordinate
      const res1 = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [77.5946]
          }
        });
      expect(res1.status).toBe(422);

      // 3 coordinates
      const res2 = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [77.5946, 12.9716, 100]
          }
        });
      expect(res2.status).toBe(422);
    });

    test("9. Out-of-range longitude is rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });

      const resHigh = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [181, 12.9716]
          }
        });
      expect(resHigh.status).toBe(422);

      const resLow = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [-181, 12.9716]
          }
        });
      expect(resLow.status).toBe(422);
    });

    test("10. Out-of-range latitude is rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });

      const resHigh = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [77.5946, 91]
          }
        });
      expect(resHigh.status).toBe(422);

      const resLow = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: {
            type: "Point",
            coordinates: [77.5946, -91]
          }
        });
      expect(resLow.status).toBe(422);
    });

    test("11. Donor cannot modify NGO-only profile fields through the profile update endpoint", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          name: "Updated Donor Name",
          acceptedCategories: ["Cooked Food"],
          operatingRadiusKm: 50,
          isAcceptingDonations: false,
          currentNeedDescription: "Donor should not have this"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Donor Name");
      expect(res.body.data.acceptedCategories).toEqual([]);
      expect(res.body.data.operatingRadiusKm).toBeUndefined();
      expect(res.body.data.isAcceptingDonations).toBe(true);
      expect(res.body.data.currentNeedDescription).toBeUndefined();

      const inDb = await User.findById(donor._id);
      expect(inDb.acceptedCategories).toEqual([]);
      expect(inDb.operatingRadiusKm).toBeUndefined();
      expect(inDb.currentNeedDescription).toBeUndefined();
    });

    test("12. Existing users can update their profile without providing geoLocation", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR, phone: "+1 555 000 1111" });
      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          name: "Just Name Update",
          phone: "+1 555 999 8888"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Just Name Update");
      expect(res.body.data.phone).toBe("+1 555 999 8888");
      expect(res.body.data.geoLocation).toBeUndefined();
    });

    test("13. Saved User.geoLocation can be cleared by sending geoLocation: null", async () => {
      const donor = await createUser({
        role: USER_ROLES.DONOR
      });
      donor.geoLocation = { type: "Point", coordinates: [77.5946, 12.9716] };
      await donor.save();

      const res = await request(app)
        .put("/api/users/me")
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: null
        });

      expect(res.status).toBe(200);
      expect(res.body.data.geoLocation).toBeUndefined();

      const inDb = await User.findById(donor._id);
      expect(inDb.geoLocation).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  // DONATION TESTS
  // ──────────────────────────────────────────────

  describe("Donation Creation & Update (POST / PUT /api/donations)", () => {
    test("1. Existing old-style donation creation using only quantity string still works", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Rice Pack",
          category: "Rice",
          quantity: "20 kg",
          description: "Fresh bags of rice",
          location: "Downtown Hub",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.data.foodName).toBe("Rice Pack");
      expect(res.body.data.quantity).toBe("20 kg");
      expect(res.body.data.quantityValue).toBeUndefined();
      expect(res.body.data.quantityUnit).toBeUndefined();
      expect(res.body.data.geoLocation).toBeUndefined();
    });

    test("2. Donation can be created with quantityValue + quantityUnit", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Bread Loaves",
          category: "Bakery",
          quantity: "25 loaves",
          quantityValue: 25,
          quantityUnit: "loaves",
          description: "Freshly baked",
          location: "Sunrise Bakery",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.data.quantityValue).toBe(25);
      expect(res.body.data.quantityUnit).toBe("loaves");
    });

    test("3. quantityValue without quantityUnit is rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Bread Loaves",
          category: "Bakery",
          quantity: "25 loaves",
          quantityValue: 25,
          description: "Freshly baked",
          location: "Sunrise Bakery",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("4. quantityUnit without quantityValue is rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Bread Loaves",
          category: "Bakery",
          quantity: "25 loaves",
          quantityUnit: "loaves",
          description: "Freshly baked",
          location: "Sunrise Bakery",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("5. Invalid quantityUnit is rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Apples",
          category: "Fruits",
          quantity: "10 crates",
          quantityValue: 10,
          quantityUnit: "crates",
          description: "Fresh apples",
          location: "Orchard",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("6. Invalid geoLocation is rejected", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Curry",
          category: "Cooked Food",
          quantity: "10 servings",
          description: "Hot curry",
          location: "Kitchen",
          availableUntil: new Date(Date.now() + 86400000).toISOString(),
          geoLocation: {
            type: "Polygon",
            coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]]
          }
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("7. Donation with explicit geoLocation stores that location", async () => {
      const donor = await createUser({
        role: USER_ROLES.DONOR,
        geoLocation: { type: "Point", coordinates: [77.0, 12.0] }
      });
      // Donor has [77.0, 12.0] as base, but donation is created at [88.0, 22.0]
      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Rice Box",
          category: "Rice",
          quantity: "5 kg",
          description: "Rice at branch location",
          location: "Branch Office",
          availableUntil: new Date(Date.now() + 86400000).toISOString(),
          geoLocation: {
            type: "Point",
            coordinates: [88.0, 22.0]
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.data.geoLocation).toEqual({
        type: "Point",
        coordinates: [88.0, 22.0]
      });
    });

    test("8. Donation without explicit geoLocation copies the authenticated donor's valid User.geoLocation", async () => {
      const donor = await createUser({
        role: USER_ROLES.DONOR
      });
      // Save donor's geoLocation
      donor.geoLocation = { type: "Point", coordinates: [77.5946, 12.9716] };
      await donor.save();

      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Vegetable Soup",
          category: "Cooked Food",
          quantity: "15 servings",
          description: "Warm soup",
          location: "Main Kitchen",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.data.geoLocation).toEqual({
        type: "Point",
        coordinates: [77.5946, 12.9716]
      });
    });

    test("9. Donation without explicit geoLocation and without donor geoLocation still works", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      // Donor has no geoLocation

      const res = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Vegetable Soup",
          category: "Cooked Food",
          quantity: "15 servings",
          description: "Warm soup",
          location: "Main Kitchen",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.data.geoLocation).toBeUndefined();
    });

    test("10. Existing donation update behavior remains intact (and allows updating geoLocation / quantity fields)", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(donor, {
        foodName: "Initial Food",
        quantity: "10 servings"
      });

      // Update foodName, location, structured quantity, and geoLocation
      const res = await request(app)
        .put(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Updated Food",
          quantityValue: 12,
          quantityUnit: "servings",
          geoLocation: {
            type: "Point",
            coordinates: [75.0, 15.0]
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.data.foodName).toBe("Updated Food");
      expect(res.body.data.quantityValue).toBe(12);
      expect(res.body.data.quantityUnit).toBe("servings");
      expect(res.body.data.geoLocation).toEqual({
        type: "Point",
        coordinates: [75.0, 15.0]
      });
    });

    test("11. Saved Donation.geoLocation can be cleared on update by sending geoLocation: null", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const donation = await Donation.create({
        foodName: "Has Geo",
        category: "Cooked Food",
        quantity: "10 servings",
        description: "Test",
        location: "Downtown",
        availableUntil: new Date(Date.now() + 86400000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
      });

      const res = await request(app)
        .put(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donor))
        .send({
          geoLocation: null
        });

      expect(res.status).toBe(200);
      expect(res.body.data.geoLocation).toBeUndefined();

      const inDb = await Donation.findById(donation._id);
      expect(inDb.geoLocation).toBeUndefined();
    });
  });
});
