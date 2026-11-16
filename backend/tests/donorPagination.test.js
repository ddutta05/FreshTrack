const request = require("supertest");
const app = require("../src/app");
const DonationOffer = require("../src/models/DonationOffer");
const DonationRequest = require("../src/models/DonationRequest");
const { USER_ROLES, REQUEST_STATUS } = require("../src/utils/constants");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");

describe("Donor list pagination", () => {
  test("donations, ordinary requests, and direct offers remain available across pages", async () => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const ngo = await createUser({ role: USER_ROLES.NGO });
    const otherNgo = await createUser({ role: USER_ROLES.NGO });
    const records = await Promise.all(Array.from({ length: 11 }, async (_, index) => {
      const donation = await createDonationForUser(donor, { foodName: `Donation ${index}` });
      const ordinaryRequest = await DonationRequest.create({
        donationId: donation._id,
        donorId: donor._id,
        ngoId: ngo._id,
        direction: "ngo_request",
        message: `Request ${index}`,
        status: REQUEST_STATUS.PENDING
      });
      const offer = await DonationOffer.create({
        donorId: donor._id,
        ngoId: ngo._id,
        targetNgoId: ngo._id,
        foodName: `Offer ${index}`,
        category: "Produce",
        quantity: "10 kg",
        description: "Fresh food",
        location: "Downtown",
        availableUntil: new Date(Date.now() + 86400000),
        status: REQUEST_STATUS.PENDING
      });
      return { donation, ordinaryRequest, offer };
    }));

    const headers = { Authorization: authHeaderFor(donor) };
    const endpoints = [
      { path: "/api/donations/mine", expectedIds: records.map(({ donation }) => donation._id.toString()), idField: "id" },
      { path: "/api/requests", expectedIds: records.map(({ ordinaryRequest }) => ordinaryRequest._id.toString()), idField: "id" },
      { path: "/api/offers/mine", expectedIds: records.map(({ offer }) => offer._id.toString()), idField: "id" }
    ];

    for (const endpoint of endpoints) {
      const firstPage = await request(app)
        .get(`${endpoint.path}?page=1&limit=10`)
        .set(headers);
      const secondPage = await request(app)
        .get(`${endpoint.path}?page=2&limit=10`)
        .set(headers);

      expect(firstPage.status).toBe(200);
      expect(secondPage.status).toBe(200);
      expect(firstPage.body.data.items).toHaveLength(10);
      expect(firstPage.body.data.pagination).toMatchObject({ page: 1, limit: 10, total: 11, pages: 2 });
      expect(secondPage.body.data.items).toHaveLength(1);
      expect(secondPage.body.data.pagination).toMatchObject({ page: 2, limit: 10, total: 11, pages: 2 });

      const returnedIds = [
        ...firstPage.body.data.items.map((item) => item[endpoint.idField]),
        ...secondPage.body.data.items.map((item) => item[endpoint.idField])
      ].sort();
      expect(returnedIds).toEqual(endpoint.expectedIds.sort());
    }

    const privateRequestId = records[0].ordinaryRequest._id.toString();
    const unauthorized = await request(app)
      .get(`/api/requests/${privateRequestId}`)
      .set("Authorization", authHeaderFor(otherNgo));
    expect(unauthorized.status).toBe(403);
    expect(unauthorized.body.data).toBeUndefined();
    expect(JSON.stringify(unauthorized.body)).not.toContain("Request 0");
  });
});
