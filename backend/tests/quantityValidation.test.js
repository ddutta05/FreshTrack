const request = require("supertest");
const app = require("../src/app");
const Donation = require("../src/models/Donation");
const DonationOffer = require("../src/models/DonationOffer");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");
const { USER_ROLES } = require("../src/utils/constants");

const createRoutes = [
  {
    name: "normal donation",
    path: "/api/donations",
    payload: (ngoId) => ({
      foodName: "Structured quantity test",
      category: "Rice",
      description: "Quantity validation coverage",
      location: "Test pickup",
      availableUntil: new Date(Date.now() + 86400000).toISOString(),
      geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] },
      ...(ngoId ? { targetNgoId: ngoId } : {})
    })
  },
  {
    name: "dedicated direct offer",
    path: "/api/offers",
    payload: (ngoId) => ({
      ngoId,
      foodName: "Structured quantity test",
      category: "Rice"
    })
  },
  {
    name: "legacy direct-offer route",
    path: "/api/requests",
    payload: (ngoId) => ({
      ngoId,
      foodName: "Structured quantity test",
      category: "Rice"
    })
  }
];

const invalidQuantities = [
  ["legacy quantity without structured fields", { quantity: "5 kg" }],
  ["missing value", { quantityUnit: "kg" }],
  ["missing unit", { quantityValue: 5 }],
  ["non-numeric value", { quantityValue: "not-a-number", quantityUnit: "kg" }],
  ["infinite value", { quantityValue: "Infinity", quantityUnit: "kg" }],
  ["negative value", { quantityValue: -1, quantityUnit: "kg" }],
  ["unsupported unit", { quantityValue: 5, quantityUnit: "crates" }]
];

describe("structured quantity API validation", () => {
  test.each(createRoutes)("$name rejects missing and invalid structured quantities", async ({ path, payload }) => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const ngo = await createUser({ role: USER_ROLES.NGO });

    for (const [, quantity] of invalidQuantities) {
      const response = await request(app)
        .post(path)
        .set("Authorization", authHeaderFor(donor))
        .send({ ...payload(ngo._id.toString()), ...quantity });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.message).toBeTruthy();
    }
  });

  test.each([
    ...createRoutes.map((route) => [route.name, route.path, route.payload, false]),
    ["targeted NGO donation offer", "/api/donations", createRoutes[0].payload, true]
  ])("%s stores a server-derived structured quantity", async (_name, path, payload, targeted) => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const ngo = await createUser({ role: USER_ROLES.NGO });
    const response = await request(app)
      .post(path)
      .set("Authorization", authHeaderFor(donor))
      .send({
        ...payload(targeted || path !== "/api/donations" ? ngo._id.toString() : undefined),
        quantity: "untrusted client value",
        quantityValue: 5,
        quantityUnit: "other"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.quantity).toBe("5 other");
    const stored = targeted || path !== "/api/donations"
      ? await DonationOffer.findById(response.body.data.id)
      : await Donation.findById(response.body.data.id);
    expect(stored.quantity).toBe("5 other");
    expect(stored.quantityValue).toBe(5);
    expect(stored.quantityUnit).toBe("other");
  });

  test("donor direct offers through POST /api/requests store image and pickup coordinates", async () => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const ngo = await createUser({ role: USER_ROLES.NGO });
    const geoLocation = { type: "Point", coordinates: [77.5946, 12.9716] };

    const response = await request(app)
      .post("/api/requests")
      .set("Authorization", authHeaderFor(donor))
      .send({
        ngoId: ngo._id.toString(),
        foodName: "Image and coordinate offer",
        category: "Rice",
        quantityValue: 4,
        quantityUnit: "kg",
        quantity: "ignored client quantity",
        description: "Direct offer metadata test",
        location: "Test pickup",
        geoLocation,
        image: "https://example.com/direct-offer.jpg"
      });

    expect(response.status).toBe(201);
    const stored = await DonationOffer.findById(response.body.data.id);
    expect(stored.quantity).toBe("4 kg");
    expect(stored.image).toBe("https://example.com/direct-offer.jpg");
    expect(stored.geoLocation.toObject()).toEqual(geoLocation);
  });

  test("legacy donations remain readable and unrelated updates preserve their quantity", async () => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const donation = await createDonationForUser(donor, {
      quantity: "historical free-text amount",
      geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
    });

    const update = await request(app)
      .put(`/api/donations/${donation._id}`)
      .set("Authorization", authHeaderFor(donor))
      .send({
        foodName: "Updated legacy donation",
        quantity: "must not replace historical quantity",
        geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
      });

    expect(update.status).toBe(200);
    expect(update.body.data.quantity).toBe("historical free-text amount");
    expect((await Donation.findById(donation._id)).quantity).toBe("historical free-text amount");
  });

  test("donation updates require a valid structured pair when either field is supplied", async () => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const donation = await createDonationForUser(donor, {
      geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
    });

    const incomplete = await request(app)
      .put(`/api/donations/${donation._id}`)
      .set("Authorization", authHeaderFor(donor))
      .send({
        quantityValue: 5,
        geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
      });
    expect(incomplete.status).toBe(422);

    const valid = await request(app)
      .put(`/api/donations/${donation._id}`)
      .set("Authorization", authHeaderFor(donor))
      .send({
        quantityValue: 5,
        quantityUnit: "kg",
        quantity: "wrong client value",
        geoLocation: { type: "Point", coordinates: [77.5946, 12.9716] }
      });
    expect(valid.status).toBe(200);
    expect(valid.body.data.quantity).toBe("5 kg");
    const stored = await Donation.findById(donation._id);
    expect(stored.quantity).toBe("5 kg");
    expect(stored.quantityValue).toBe(5);
    expect(stored.quantityUnit).toBe("kg");
  });
});
