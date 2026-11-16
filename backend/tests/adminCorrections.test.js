const request = require("supertest");
const app = require("../src/app");
const Donation = require("../src/models/Donation");
const DonationRequest = require("../src/models/DonationRequest");
const User = require("../src/models/User");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");
const { USER_ROLES, USER_STATUS, DONATION_STATUS, REQUEST_STATUS } = require("../src/utils/constants");

async function createAcceptedOffer() {
  const donor = await createUser({
    role: USER_ROLES.DONOR,
    email: "offer-donor@corrections.test",
    phone: "DONOR_PRIVATE_PHONE"
  });
  const ngo = await createUser({
    role: USER_ROLES.NGO,
    email: "offer-ngo@corrections.test",
    organizationName: "Offer Target NGO",
    phone: "NGO_PRIVATE_PHONE"
  });
  const offerResponse = await request(app)
    .post("/api/offers")
    .set("Authorization", authHeaderFor(donor))
    .send({
      ngoId: ngo._id.toString(),
      foodName: "Accepted offer fixture",
      category: "Rice",
      quantity: "5 boxes"
    });

  await request(app)
    .put(`/api/offers/${offerResponse.body.data.id}/accept`)
    .set("Authorization", authHeaderFor(ngo))
    .expect(200);

  return { donor, ngo, offerId: offerResponse.body.data.id };
}

describe("Admin audit corrections", () => {
  describe("Direct offer contact visibility", () => {
    test("hides private contact from admin list and detail while preserving participant access", async () => {
      const { donor, ngo, offerId } = await createAcceptedOffer();
      const admin = await createUser({ role: USER_ROLES.ADMIN });

      const adminList = await request(app)
        .get("/api/offers")
        .set("Authorization", authHeaderFor(admin))
        .expect(200);
      const listedOffer = adminList.body.data.find((offer) => offer.id === offerId);
      expect(listedOffer).toBeDefined();
      expect(listedOffer).not.toHaveProperty("contact");
      expect(JSON.stringify(listedOffer)).not.toContain("DONOR_PRIVATE_PHONE");
      expect(JSON.stringify(listedOffer)).not.toContain("NGO_PRIVATE_PHONE");

      const adminDetail = await request(app)
        .get(`/api/offers/${offerId}`)
        .set("Authorization", authHeaderFor(admin))
        .expect(200);
      expect(adminDetail.body.data).not.toHaveProperty("contact");

      for (const [participant, route] of [[donor, "/api/offers"], [ngo, "/api/offers"]]) {
        const participantList = await request(app)
          .get(route)
          .set("Authorization", authHeaderFor(participant))
          .expect(200);
        const participantOffer = participantList.body.data.find((offer) => offer.id === offerId);
        expect(participantOffer.contact.donor.phone).toBe("DONOR_PRIVATE_PHONE");
        expect(participantOffer.contact.ngo.phone).toBe("NGO_PRIVATE_PHONE");

        const participantDetail = await request(app)
          .get(`/api/offers/${offerId}`)
          .set("Authorization", authHeaderFor(participant))
          .expect(200);
        expect(participantDetail.body.data.contact.donor.phone).toBe("DONOR_PRIVATE_PHONE");
        expect(participantDetail.body.data.contact.ngo.phone).toBe("NGO_PRIVATE_PHONE");
      }
    });

    test("unrelated users retain offer visibility restrictions", async () => {
      const { offerId } = await createAcceptedOffer();
      const unrelatedNgo = await createUser({ role: USER_ROLES.NGO });
      const unrelatedDonor = await createUser({ role: USER_ROLES.DONOR });

      for (const user of [unrelatedNgo, unrelatedDonor]) {
        const list = await request(app)
          .get("/api/offers")
          .set("Authorization", authHeaderFor(user))
          .expect(200);
        expect(list.body.data).toHaveLength(0);

        await request(app)
          .get(`/api/offers/${offerId}`)
          .set("Authorization", authHeaderFor(user))
          .expect(403);
      }
    });
  });

  describe("Admin self-disable protection", () => {
    test("blocks generic and dedicated self-disable while allowing another admin to manage users", async () => {
      const admin = await createUser({ role: USER_ROLES.ADMIN });
      const otherAdmin = await createUser({ role: USER_ROLES.ADMIN });
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });

      await request(app)
        .put(`/api/users/${admin._id}`)
        .set("Authorization", authHeaderFor(admin))
        .send({ status: USER_STATUS.DISABLED })
        .expect(400);

      await request(app)
        .put(`/api/users/${admin._id}/disable`)
        .set("Authorization", authHeaderFor(admin))
        .expect(400);

      expect((await User.findById(admin._id)).status).toBe(USER_STATUS.ACTIVE);

      await request(app)
        .put(`/api/users/${donor._id}/disable`)
        .set("Authorization", authHeaderFor(otherAdmin))
        .expect(200);
      expect((await User.findById(donor._id)).status).toBe(USER_STATUS.DISABLED);

      await request(app)
        .put(`/api/users/${donor._id}/enable`)
        .set("Authorization", authHeaderFor(otherAdmin))
        .expect(200);
      await request(app)
        .put(`/api/users/${ngo._id}/disable`)
        .set("Authorization", authHeaderFor(otherAdmin))
        .expect(200);
      await request(app)
        .put(`/api/users/${ngo._id}/enable`)
        .set("Authorization", authHeaderFor(otherAdmin))
        .expect(200);
      expect((await User.findById(donor._id)).status).toBe(USER_STATUS.ACTIVE);
      expect((await User.findById(ngo._id)).status).toBe(USER_STATUS.ACTIVE);
    });
  });

  describe("Admin pagination and search", () => {
    test("user list paginates and searches records outside the first page", async () => {
      const admin = await createUser({ role: USER_ROLES.ADMIN });
      const users = [];
      for (let index = 0; index < 12; index += 1) {
        const user = await createUser({
          name: `Pagination user ${String(index).padStart(2, "0")}`,
          email: `pagination-user-${index}@corrections.test`
        });
        await User.collection.updateOne(
          { _id: user._id },
          { $set: { createdAt: new Date(Date.UTC(2020, 0, index + 1)) } }
        );
        users.push(user);
      }
      await User.collection.updateOne(
        { _id: admin._id },
        { $set: { createdAt: new Date(Date.UTC(2019, 0, 1)) } }
      );

      const firstPage = await request(app)
        .get("/api/users?page=1&limit=10")
        .set("Authorization", authHeaderFor(admin))
        .expect(200);
      const secondPage = await request(app)
        .get("/api/users?page=2&limit=10")
        .set("Authorization", authHeaderFor(admin))
        .expect(200);

      expect(firstPage.body.data.items).toHaveLength(10);
      expect(secondPage.body.data.items).toHaveLength(3);
      const firstPageIds = firstPage.body.data.items.map((user) => user.id);
      expect(secondPage.body.data.items.every((user) => !firstPageIds.includes(user.id))).toBe(true);

      const olderUser = users[0];
      const search = await request(app)
        .get(`/api/users?page=1&limit=10&search=${encodeURIComponent(olderUser.name)}`)
        .set("Authorization", authHeaderFor(admin))
        .expect(200);
      expect(search.body.data.items.map((user) => user.id)).toContain(olderUser._id.toString());
    });

    test("donation list paginates and searches older food names and locations", async () => {
      const admin = await createUser({ role: USER_ROLES.ADMIN });
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const donations = [];
      for (let index = 0; index < 12; index += 1) {
        const donation = await createDonationForUser(donor, {
          foodName: `Pagination food ${String(index).padStart(2, "0")}`,
          location: `Pagination location ${String(index).padStart(2, "0")}`
        });
        await Donation.collection.updateOne(
          { _id: donation._id },
          { $set: { createdAt: new Date(Date.UTC(2020, 0, index + 1)) } }
        );
        donations.push(donation);
      }

      const firstPage = await request(app)
        .get("/api/admin/donations?page=1&limit=10")
        .set("Authorization", authHeaderFor(admin))
        .expect(200);
      const secondPage = await request(app)
        .get("/api/admin/donations?page=2&limit=10")
        .set("Authorization", authHeaderFor(admin))
        .expect(200);

      expect(firstPage.body.data.items).toHaveLength(10);
      expect(secondPage.body.data.items).toHaveLength(2);
      const firstPageIds = firstPage.body.data.items.map((donation) => donation.id);
      expect(secondPage.body.data.items.every((donation) => !firstPageIds.includes(donation.id))).toBe(true);

      const olderDonation = donations[0];
      const foodSearch = await request(app)
        .get(`/api/admin/donations?page=1&limit=10&search=${encodeURIComponent(olderDonation.foodName)}`)
        .set("Authorization", authHeaderFor(admin))
        .expect(200);
      expect(foodSearch.body.data.items.map((donation) => donation.id)).toContain(olderDonation._id.toString());

      const locationSearch = await request(app)
        .get(`/api/admin/donations?page=1&limit=10&search=${encodeURIComponent(olderDonation.location)}`)
        .set("Authorization", authHeaderFor(admin))
        .expect(200);
      expect(locationSearch.body.data.items.map((donation) => donation.id)).toContain(olderDonation._id.toString());
    });

    test("keeps accepted donations protected from admin deletion", async () => {
      const admin = await createUser({ role: USER_ROLES.ADMIN });
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const donation = await createDonationForUser(donor, { status: DONATION_STATUS.ACCEPTED });
      await DonationRequest.create({
        donationId: donation._id,
        donorId: donor._id,
        ngoId: ngo._id,
        status: REQUEST_STATUS.ACCEPTED,
        message: "Accepted donation"
      });

      await request(app)
        .delete(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(admin))
        .expect(409);
      expect(await Donation.exists({ _id: donation._id })).toBeTruthy();
    });

    test("keeps completed donations protected from admin deletion", async () => {
      const admin = await createUser({ role: USER_ROLES.ADMIN });
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const donation = await createDonationForUser(donor, { status: DONATION_STATUS.COMPLETED });
      await DonationRequest.create({
        donationId: donation._id,
        donorId: donor._id,
        ngoId: ngo._id,
        status: REQUEST_STATUS.COMPLETED,
        donorCompletedAt: new Date(),
        ngoCompletedAt: new Date(),
        message: "Completed donation"
      });

      await request(app)
        .delete(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(admin))
        .expect(409);
      expect(await Donation.exists({ _id: donation._id })).toBeTruthy();
    });
  });
});
