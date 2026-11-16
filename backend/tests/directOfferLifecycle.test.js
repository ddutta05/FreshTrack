const request = require("supertest");
const app = require("../src/app");
const DonationOffer = require("../src/models/DonationOffer");
const { createUser, authHeaderFor } = require("./helpers/factories");
const { REQUEST_STATUS, USER_ROLES } = require("../src/utils/constants");

beforeAll(async () => {
  await DonationOffer.createCollection();
});

describe("Direct Offer lifecycle", () => {
  test("allows repeated offers for the same NGO and lists both records for each participant", async () => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Repeat Offer NGO" });
    const payload = {
      ngoId: ngo._id.toString(),
      foodName: "Repeated Synthetic Rice Offer",
      category: "Rice",
      quantity: "3 boxes",
      description: "Synthetic duplicate-offer behavior test",
      location: "Test pickup",
      availableUntil: new Date(Date.now() + 86400000).toISOString()
    };

    const first = await request(app)
      .post("/api/offers")
      .set("Authorization", authHeaderFor(donor))
      .send(payload);
    const second = await request(app)
      .post("/api/offers")
      .set("Authorization", authHeaderFor(donor))
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).not.toBe(second.body.data.id);
    expect(await DonationOffer.countDocuments({
      donorId: donor._id,
      ngoId: ngo._id,
      foodName: payload.foodName
    })).toBe(2);

    const donorOffers = await request(app)
      .get("/api/offers/mine")
      .set("Authorization", authHeaderFor(donor));
    const ngoOffers = await request(app)
      .get("/api/offers/received")
      .set("Authorization", authHeaderFor(ngo));

    expect(donorOffers.status).toBe(200);
    expect(ngoOffers.status).toBe(200);
    for (const response of [donorOffers, ngoOffers]) {
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((offer) => offer.id)).toEqual(expect.arrayContaining([
        first.body.data.id,
        second.body.data.id
      ]));
      expect(response.body.data.every((offer) => offer.status === REQUEST_STATUS.PENDING)).toBe(true);
    }
  });
});
