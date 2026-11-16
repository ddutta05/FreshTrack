const request = require("supertest");
const sharp = require("sharp");
const app = require("../src/app");
const Donation = require("../src/models/Donation");
const DonationRequest = require("../src/models/DonationRequest");
const Notification = require("../src/models/Notification");
const { DONATION_STATUS, REQUEST_STATUS, USER_ROLES } = require("../src/utils/constants");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");

beforeAll(async () => {
  await Promise.all([DonationRequest.createCollection(), Notification.createCollection()]);
});

async function createRequest(donor, ngo, donation, status = REQUEST_STATUS.PENDING) {
  const created = await request(app)
    .post("/api/requests")
    .set("Authorization", authHeaderFor(ngo))
    .send({ donationId: donation._id.toString(), message: "Please reserve this donation" });

  expect(created.status).toBe(201);
  const requestId = created.body.data.id;

  if (status === REQUEST_STATUS.REJECTED) {
    const rejected = await request(app)
      .put(`/api/requests/${requestId}/reject`)
      .set("Authorization", authHeaderFor(donor));
    expect(rejected.status).toBe(200);
  }

  if ([REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.COMPLETED].includes(status)) {
    const accepted = await request(app)
      .put(`/api/requests/${requestId}/accept`)
      .set("Authorization", authHeaderFor(donor));
    expect(accepted.status).toBe(200);
  }

  if (status === REQUEST_STATUS.COMPLETED) {
    const ngoComplete = await request(app)
      .put(`/api/requests/${requestId}/complete`)
      .set("Authorization", authHeaderFor(ngo));
    expect(ngoComplete.status).toBe(200);
    const donorComplete = await request(app)
      .put(`/api/requests/${requestId}/complete`)
      .set("Authorization", authHeaderFor(donor));
    expect(donorComplete.status).toBe(200);
  }

  return DonationRequest.findById(requestId);
}

describe("Donation lifecycle protections", () => {
  describe("editing", () => {
    test("accepted donation owner cannot change any agreed donation details", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const donation = await createDonationForUser(donor);
      await createRequest(donor, ngo, donation, REQUEST_STATUS.ACCEPTED);
      const original = await Donation.findById(donation._id).lean();
      const attemptedChanges = [
        { foodName: "Changed food name" },
        { quantity: "Changed display quantity" },
        { description: "Changed description" },
        { location: "Changed pickup location" },
        { availableUntil: new Date(Date.now() + 5 * 86400000).toISOString() }
      ];

      for (const changes of attemptedChanges) {
        const response = await request(app)
          .put(`/api/donations/${donation._id}`)
          .set("Authorization", authHeaderFor(donor))
          .send(changes);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("DONATION_LOCKED");
        const unchanged = await Donation.findById(donation._id).lean();
        expect(unchanged).toEqual(original);
      }
    });

    test("available and rejected-request donations remain editable", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const availableDonation = await createDonationForUser(donor);

      const availableUpdate = await request(app)
        .put(`/api/donations/${availableDonation._id}`)
        .set("Authorization", authHeaderFor(donor))
        .send({ foodName: "Available donation edited" });
      expect(availableUpdate.status).toBe(200);
      expect(availableUpdate.body.data.foodName).toBe("Available donation edited");

      const rejectedDonation = await createDonationForUser(donor);
      await createRequest(donor, ngo, rejectedDonation, REQUEST_STATUS.REJECTED);
      const rejectedUpdate = await request(app)
        .put(`/api/donations/${rejectedDonation._id}`)
        .set("Authorization", authHeaderFor(donor))
        .send({ location: "New pickup location" });
      expect(rejectedUpdate.status).toBe(200);
      expect(rejectedUpdate.body.data.location).toBe("New pickup location");
      expect((await Donation.findById(rejectedDonation._id)).status).toBe(DONATION_STATUS.AVAILABLE);
    });

    test.each([
      [DONATION_STATUS.EXPIRED, "expired"],
      [DONATION_STATUS.COMPLETED, "completed"]
    ])("%s donations cannot be edited or reactivated", async (status) => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(donor, {
        status,
        availableUntil: status === DONATION_STATUS.EXPIRED
          ? new Date(Date.now() - 60000)
          : new Date(Date.now() + 86400000)
      });
      const original = await Donation.findById(donation._id).lean();
      const response = await request(app)
        .put(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donor))
        .send({ availableUntil: new Date(Date.now() + 5 * 86400000).toISOString() });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("DONATION_LOCKED");
      expect(await Donation.findById(donation._id).lean()).toEqual(original);
    });

    test("completed request history also prevents editing", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const donation = await createDonationForUser(donor);
      await createRequest(donor, ngo, donation, REQUEST_STATUS.COMPLETED);

      const response = await request(app)
        .put(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donor))
        .send({ quantity: "Changed after completion" });
      expect(response.status).toBe(409);
      expect((await Donation.findById(donation._id)).quantity).toBe(donation.quantity);
    });
  });

  describe("deletion", () => {
    test.each([REQUEST_STATUS.PENDING, REQUEST_STATUS.REJECTED])("removes %s requests and detaches their notification references", async (status) => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const donation = await createDonationForUser(donor);
      const donationRequest = await createRequest(donor, ngo, donation, status);
      const notificationBefore = await Notification.find({
        $or: [{ donationId: donation._id }, { requestId: donationRequest._id }]
      }).lean();
      expect(notificationBefore.length).toBeGreaterThan(0);

      const response = await request(app)
        .delete(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donor));

      expect(response.status).toBe(200);
      expect(await Donation.findById(donation._id)).toBeNull();
      expect(await DonationRequest.findById(donationRequest._id)).toBeNull();
      const notificationsAfter = await Notification.find({ _id: { $in: notificationBefore.map(({ _id }) => _id) } }).lean();
      expect(notificationsAfter).toHaveLength(notificationBefore.length);
      expect(notificationsAfter.every((notification) => !notification.donationId && !notification.requestId)).toBe(true);
    });

    test.each([REQUEST_STATUS.ACCEPTED, REQUEST_STATUS.COMPLETED])("blocks deletion with %s request and leaves all records unchanged", async (status) => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const donation = await createDonationForUser(donor);
      const donationRequest = await createRequest(donor, ngo, donation, status);
      const beforeDonation = await Donation.findById(donation._id).lean();
      const beforeRequest = await DonationRequest.findById(donationRequest._id).lean();
      const beforeNotifications = await Notification.find({
        $or: [{ donationId: donation._id }, { requestId: donationRequest._id }]
      }).lean();

      const response = await request(app)
        .delete(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donor));

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("DONATION_HAS_PROTECTED_REQUEST");
      expect(await Donation.findById(donation._id).lean()).toEqual(beforeDonation);
      expect(await DonationRequest.findById(donationRequest._id).lean()).toEqual(beforeRequest);
      expect(await Notification.find({ _id: { $in: beforeNotifications.map(({ _id }) => _id) } }).lean()).toEqual(beforeNotifications);
    });

    test("unrelated donor cannot delete another donor's donation", async () => {
      const owner = await createUser({ role: USER_ROLES.DONOR });
      const unrelatedDonor = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(owner);
      const before = await Donation.findById(donation._id).lean();

      const response = await request(app)
        .delete(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(unrelatedDonor));

      expect(response.status).toBe(403);
      expect(await Donation.findById(donation._id).lean()).toEqual(before);
    });

    test("owner can delete an expired donation with no protected request history", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(donor, {
        status: DONATION_STATUS.EXPIRED,
        availableUntil: new Date(Date.now() - 60000)
      });

      const response = await request(app)
        .delete(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donor));

      expect(response.status).toBe(200);
      expect(await Donation.findById(donation._id)).toBeNull();
    });
  });

  describe("request retry and contact lifecycle", () => {
    test("keeps rejected history visible after a retry and retains contact data through completion", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR, name: "Retry Donor" });
      const ngo = await createUser({ role: USER_ROLES.NGO, name: "Retry NGO", organizationName: "Retry NGO", phone: "555-0101", email: "retry-ngo@test.dev" });
      const donation = await createDonationForUser(donor, { foodName: "Retry Rice Donation" });

      const firstRequest = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "First attempt" });
      expect(firstRequest.status).toBe(201);

      const rejectFirst = await request(app)
        .put(`/api/requests/${firstRequest.body.data.id}/reject`)
        .set("Authorization", authHeaderFor(donor));
      expect(rejectFirst.status).toBe(200);

      const secondRequest = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Second attempt" });
      expect(secondRequest.status).toBe(201);

      const duplicate = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Duplicate attempt" });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe("DUPLICATE_ACTIVE_REQUEST");

      const donorHistory = await request(app)
        .get(`/api/requests?donationId=${donation._id.toString()}`)
        .set("Authorization", authHeaderFor(donor));
      expect(donorHistory.status).toBe(200);
      const donorStatuses = donorHistory.body.data.map((item) => ({ id: item.id, status: item.status }));
      expect(donorStatuses).toEqual(expect.arrayContaining([
        { id: firstRequest.body.data.id, status: REQUEST_STATUS.REJECTED },
        { id: secondRequest.body.data.id, status: REQUEST_STATUS.PENDING }
      ]));
      const foundPending = donorHistory.body.data.find((item) => item.id === secondRequest.body.data.id);
      expect(foundPending).toBeTruthy();
      expect(foundPending.status).toBe(REQUEST_STATUS.PENDING);

      const acceptSecond = await request(app)
        .put(`/api/requests/${secondRequest.body.data.id}/accept`)
        .set("Authorization", authHeaderFor(donor));
      expect(acceptSecond.status).toBe(200);

      const donorDetails = await request(app)
        .get(`/api/requests/${secondRequest.body.data.id}`)
        .set("Authorization", authHeaderFor(donor));
      expect(donorDetails.status).toBe(200);
      expect(donorDetails.body.data.contact).toBeTruthy();
      expect(donorDetails.body.data.contact.ngo.name).toBe(ngo.organizationName);

      const ngoRequests = await request(app)
        .get("/api/requests/mine")
        .set("Authorization", authHeaderFor(ngo));
      expect(ngoRequests.status).toBe(200);
      expect(ngoRequests.body.data.map((item) => ({ id: item.id, status: item.status }))).toEqual(
        expect.arrayContaining([
          { id: firstRequest.body.data.id, status: REQUEST_STATUS.REJECTED },
          { id: secondRequest.body.data.id, status: REQUEST_STATUS.ACCEPTED }
        ])
      );

      const ngoComplete = await request(app)
        .put(`/api/requests/${secondRequest.body.data.id}/complete`)
        .set("Authorization", authHeaderFor(ngo));
      expect(ngoComplete.status).toBe(200);

      const donorComplete = await request(app)
        .put(`/api/requests/${secondRequest.body.data.id}/complete`)
        .set("Authorization", authHeaderFor(donor));
      expect(donorComplete.status).toBe(200);

      const finalRequest = await request(app)
        .get(`/api/requests/${secondRequest.body.data.id}`)
        .set("Authorization", authHeaderFor(donor));
      expect(finalRequest.status).toBe(200);
      expect(finalRequest.body.data.status).toBe(REQUEST_STATUS.COMPLETED);
      expect(finalRequest.body.data.contact).toBeTruthy();
      expect(finalRequest.body.data.contact.handoffMessage).toMatch(/pickup|drop-off/i);
    });
  });

  describe("image upload errors", () => {
    const fields = (payload) => payload
      .field("foodName", "Upload test food")
      .field("category", "Other")
      .field("quantity", "six containers")
      .field("description", "Upload test")
      .field("location", "Community center")
      .field("availableUntil", new Date(Date.now() + 86400000).toISOString());

    test("accepts and stores a supported image", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const image = await sharp({
        create: { width: 32, height: 32, channels: 4, background: { r: 12, g: 120, b: 80, alpha: 1 } }
      }).png().toBuffer();
      const response = await fields(request(app).post("/api/donations").set("Authorization", authHeaderFor(donor)))
        .attach("image", image, { filename: "valid.png", contentType: "image/png" });

      expect(response.status).toBe(201);
      expect(response.body.data.image).toMatch(/^data:image\/png;base64,/);
    });

    test("returns 422 with a clear message for unsupported image types", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const response = await fields(request(app).post("/api/donations").set("Authorization", authHeaderFor(donor)))
        .attach("image", Buffer.from("not an image"), { filename: "bad.txt", contentType: "text/plain" });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("INVALID_IMAGE_MIME_TYPE");
      expect(response.body.message).toMatch(/unsupported image type/i);
    });

    test("retains 413 behavior for oversized images", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const response = await fields(request(app).post("/api/donations").set("Authorization", authHeaderFor(donor)))
        .attach("image", Buffer.alloc(6 * 1024 * 1024), { filename: "large.png", contentType: "image/png" });

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe("FILE_TOO_LARGE");
    });
  });
});