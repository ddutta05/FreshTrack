/**
 * Tests for Phase 1A schema changes:
 * - User.geoLocation (GeoJSON Point, 2dsphere)
 * - User NGO profile fields
 * - Donation.geoLocation (GeoJSON Point, 2dsphere)
 * - Donation.quantityValue / quantityUnit
 * - Backward compatibility (existing records without new fields)
 */

const User = require("../src/models/User");
const Donation = require("../src/models/Donation");
const { USER_ROLES, USER_STATUS, DONATION_STATUS, QUANTITY_UNITS } = require("../src/utils/constants");

describe("Phase 1A — Schema changes", () => {
  // ──────────────────────────────────────────────
  // USER MODEL
  // ──────────────────────────────────────────────

  describe("User model", () => {
    test("user can exist without geoLocation", async () => {
      const user = await User.create({
        name: "No Geo",
        email: "nogeo@test.dev",
        password: "Pass1234",
        role: USER_ROLES.DONOR,
        status: USER_STATUS.ACTIVE
      });

      // geoLocation is treated as absent/undefined when omitted
      expect(user.geoLocation).toBeUndefined();
      const client = user.toClient();
      expect(client.id).toBeTruthy();
      expect(client.name).toBe("No Geo");
      expect(client.geoLocation).toBeUndefined();
    });

    test("user with a valid GeoJSON Point is accepted", async () => {
      const user = await User.create({
        name: "Has Geo",
        email: "hasgeo@test.dev",
        password: "Pass1234",
        role: USER_ROLES.DONOR,
        status: USER_STATUS.ACTIVE,
        geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
      });

      expect(user.geoLocation.type).toBe("Point");
      expect(user.geoLocation.coordinates).toEqual([77.5946, 12.9716]);

      const client = user.toClient();
      expect(client.geoLocation.type).toBe("Point");
      expect(client.geoLocation.coordinates).toEqual([77.5946, 12.9716]);
    });

    test("user with invalid geoLocation type is rejected", async () => {
      await expect(
        User.create({
          name: "Bad Geo Polygon",
          email: "badgeo1@test.dev",
          password: "Pass1234",
          role: USER_ROLES.DONOR,
          status: USER_STATUS.ACTIVE,
          geoLocation: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] }
        })
      ).rejects.toThrow();

      await expect(
        User.create({
          name: "Bad Geo LineString",
          email: "badgeo2@test.dev",
          password: "Pass1234",
          role: USER_ROLES.DONOR,
          status: USER_STATUS.ACTIVE,
          geoLocation: { type: "LineString", coordinates: [[0, 0], [1, 1]] }
        })
      ).rejects.toThrow();
    });

    test("NGO profile fields can be stored", async () => {
      const user = await User.create({
        name: "Feed The World",
        email: "ngo-profile@test.dev",
        password: "Pass1234",
        role: USER_ROLES.NGO,
        organizationName: "Feed The World",
        status: USER_STATUS.ACTIVE,
        acceptedCategories: ["Cooked Food", "Rice", "Bakery"],
        operatingRadiusKm: 25,
        isAcceptingDonations: true,
        currentNeedDescription: "Urgently need rice and dal for 200 families."
      });

      expect(user.acceptedCategories).toEqual(["Cooked Food", "Rice", "Bakery"]);
      expect(user.operatingRadiusKm).toBe(25);
      expect(user.isAcceptingDonations).toBe(true);
      expect(user.currentNeedDescription).toBe("Urgently need rice and dal for 200 families.");

      const client = user.toClient();
      expect(client.acceptedCategories).toEqual(["Cooked Food", "Rice", "Bakery"]);
      expect(client.operatingRadiusKm).toBe(25);
      expect(client.isAcceptingDonations).toBe(true);
      expect(client.currentNeedDescription).toBe("Urgently need rice and dal for 200 families.");
    });

    test("isAcceptingDonations defaults to true", async () => {
      const user = await User.create({
        name: "Default NGO",
        email: "default-ngo@test.dev",
        password: "Pass1234",
        role: USER_ROLES.NGO,
        organizationName: "Default NGO",
        status: USER_STATUS.ACTIVE
      });

      expect(user.isAcceptingDonations).toBe(true);
    });

    test("operatingRadiusKm rejects negative values", async () => {
      await expect(
        User.create({
          name: "Bad Radius",
          email: "badradius@test.dev",
          password: "Pass1234",
          role: USER_ROLES.NGO,
          organizationName: "Bad Radius NGO",
          status: USER_STATUS.ACTIVE,
          operatingRadiusKm: -5
        })
      ).rejects.toThrow();
    });

    test("existing user records remain compatible (no new required fields)", async () => {
      // Mimics an old user that was created before the schema change
      const user = await User.create({
        name: "Legacy User",
        email: "legacy@test.dev",
        password: "Pass1234",
        role: USER_ROLES.DONOR,
        status: USER_STATUS.ACTIVE
      });

      // Must be loadable and serializable without errors
      const loaded = await User.findById(user._id);
      expect(loaded).toBeTruthy();
      const client = loaded.toClient();
      expect(client.id).toBe(user._id.toString());
      expect(client.geoLocation).toBeUndefined();
      expect(client.acceptedCategories).toEqual([]);
      expect(client.operatingRadiusKm).toBeUndefined();
      expect(client.isAcceptingDonations).toBe(true);
      expect(client.currentNeedDescription).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  // DONATION MODEL
  // ──────────────────────────────────────────────

  describe("Donation model", () => {
    let donor;

    beforeEach(async () => {
      donor = await User.create({
        name: "Donor",
        email: `donor-${Date.now()}@test.dev`,
        password: "Pass1234",
        role: USER_ROLES.DONOR,
        status: USER_STATUS.ACTIVE
      });
    });

    test("donation can exist without geoLocation", async () => {
      const donation = await Donation.create({
        foodName: "Rice",
        category: "Rice",
        quantity: "10 kg",
        description: "Basmati rice",
        location: "Downtown",
        availableUntil: new Date(Date.now() + 86400000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE
      });

      // geoLocation is treated as absent/undefined when omitted
      expect(donation.geoLocation).toBeUndefined();
      expect(donation.quantityValue).toBeUndefined();
      expect(donation.quantityUnit).toBeUndefined();
    });

    test("donation with valid GeoJSON Point is accepted", async () => {
      const donation = await Donation.create({
        foodName: "Curry",
        category: "Cooked Food",
        quantity: "15 servings",
        description: "Vegetable curry",
        location: "Kitchen A",
        availableUntil: new Date(Date.now() + 86400000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
      });

      expect(donation.geoLocation.type).toBe("Point");
      expect(donation.geoLocation.coordinates).toEqual([77.5946, 12.9716]);
    });

    test("donation with invalid geoLocation type is rejected", async () => {
      await expect(
        Donation.create({
          foodName: "Bad LineString",
          category: "Other",
          quantity: "1",
          description: "Bad geo",
          location: "Somewhere",
          availableUntil: new Date(Date.now() + 86400000),
          donorId: donor._id,
          status: DONATION_STATUS.AVAILABLE,
          geoLocation: { type: "LineString", coordinates: [[0, 0], [1, 1]] }
        })
      ).rejects.toThrow();

      await expect(
        Donation.create({
          foodName: "Bad Polygon",
          category: "Other",
          quantity: "1",
          description: "Bad geo",
          location: "Somewhere",
          availableUntil: new Date(Date.now() + 86400000),
          donorId: donor._id,
          status: DONATION_STATUS.AVAILABLE,
          geoLocation: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] }
        })
      ).rejects.toThrow();
    });

    test("quantityValue can be stored without changing quantity", async () => {
      const donation = await Donation.create({
        foodName: "Bread",
        category: "Bakery",
        quantity: "30 loaves",
        description: "Fresh bread",
        location: "Bakery",
        availableUntil: new Date(Date.now() + 86400000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE,
        quantityValue: 30,
        quantityUnit: "loaves"
      });

      expect(donation.quantity).toBe("30 loaves");
      expect(donation.quantityValue).toBe(30);
      expect(donation.quantityUnit).toBe("loaves");
    });

    test("quantityUnit rejects unsupported values", async () => {
      await expect(
        Donation.create({
          foodName: "Mystery",
          category: "Other",
          quantity: "1 barrel",
          description: "Mysterious",
          location: "Somewhere",
          availableUntil: new Date(Date.now() + 86400000),
          donorId: donor._id,
          status: DONATION_STATUS.AVAILABLE,
          quantityUnit: "barrels"
        })
      ).rejects.toThrow();
    });

    test("quantityValue rejects negative values", async () => {
      await expect(
        Donation.create({
          foodName: "Negative",
          category: "Other",
          quantity: "-5 kg",
          description: "Bad quantity",
          location: "Somewhere",
          availableUntil: new Date(Date.now() + 86400000),
          donorId: donor._id,
          status: DONATION_STATUS.AVAILABLE,
          quantityValue: -5,
          quantityUnit: "kg"
        })
      ).rejects.toThrow();
    });

    test("existing donation records remain compatible", async () => {
      // Simulates an old donation created before the schema changes
      const donation = await Donation.create({
        foodName: "Old Soup",
        category: "Cooked Food",
        quantity: "20 servings",
        description: "Soup from last week's event",
        location: "Community Hall",
        availableUntil: new Date(Date.now() + 86400000),
        donorId: donor._id,
        status: DONATION_STATUS.AVAILABLE
      });

      const loaded = await Donation.findById(donation._id);
      expect(loaded).toBeTruthy();
      expect(loaded.foodName).toBe("Old Soup");
      expect(loaded.quantity).toBe("20 servings");
      expect(loaded.location).toBe("Community Hall");
      expect(loaded.geoLocation).toBeUndefined();
      expect(loaded.quantityValue).toBeUndefined();
      expect(loaded.quantityUnit).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  // CONSTANTS
  // ──────────────────────────────────────────────

  describe("QUANTITY_UNITS constant", () => {
    test("exports the expected units", () => {
      expect(QUANTITY_UNITS).toEqual([
        "servings", "kg", "g", "liters", "loaves", "boxes", "pieces", "other"
      ]);
    });
  });
});
