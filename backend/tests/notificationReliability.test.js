jest.mock("../src/sockets/socket", () => ({
  emitToUser: jest.fn()
}));

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const Donation = require("../src/models/Donation");
const DonationOffer = require("../src/models/DonationOffer");
const DonationRequest = require("../src/models/DonationRequest");
const Notification = require("../src/models/Notification");
const { emitToUser } = require("../src/sockets/socket");
const { expireDonationsAndNotify } = require("../src/services/donation.service");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");
const { DONATION_STATUS, NOTIFICATION_TYPES, REQUEST_STATUS, USER_ROLES } = require("../src/utils/constants");

const offerRoutes = [
  {
    name: "dedicated offers endpoint",
    path: "/api/offers",
    payload: (ngoId, foodName) => ({ ngoId, foodName, category: "Rice", quantity: "3 boxes", description: "Atomic offer test", location: "Test pickup", availableUntil: new Date(Date.now() + 86400000).toISOString() }),
    successMessage: "Donation offer created successfully"
  },
  {
    name: "targeted donations endpoint",
    path: "/api/donations",
    payload: (ngoId, foodName) => ({ targetNgoId: ngoId, foodName, category: "Rice", quantity: "3 boxes", description: "Atomic offer test", location: "Test pickup", availableUntil: new Date(Date.now() + 86400000).toISOString() }),
    successMessage: "Donation offer created successfully"
  },
  {
    name: "legacy request endpoint direct-offer path",
    path: "/api/requests",
    payload: (ngoId, foodName) => ({ ngoId, foodName, category: "Rice", quantity: "3 boxes", description: "Atomic offer test", location: "Test pickup", availableUntil: new Date(Date.now() + 86400000).toISOString() }),
    successMessage: "Donation offer sent successfully"
  }
];

function trackTransactions({ failCommit = false } = {}) {
  const originalStartSession = mongoose.startSession.bind(mongoose);
  const sessions = [];
  const emissions = [];

  emitToUser.mockImplementation((userId, event, payload) => {
    emissions.push({
      userId: userId.toString(),
      event,
      payload,
      afterCommit: sessions.length > 0 && sessions.every((state) => state.committed)
    });
  });

  const startSessionSpy = jest.spyOn(mongoose, "startSession").mockImplementation(async (...args) => {
    const session = await originalStartSession(...args);
    const state = { session, committed: false };
    sessions.push(state);
    const originalCommit = session.commitTransaction.bind(session);

    session.commitTransaction = async (...commitArgs) => {
      if (failCommit) {
        throw new Error("injected transaction commit failure");
      }
      const result = await originalCommit(...commitArgs);
      state.committed = true;
      return result;
    };

    return session;
  });

  return {
    emissions,
    restore: () => startSessionSpy.mockRestore()
  };
}

async function createDonorAndNgo() {
  const donor = await createUser({ role: USER_ROLES.DONOR });
  const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Atomicity NGO" });
  return { donor, ngo, donorAuth: authHeaderFor(donor), ngoAuth: authHeaderFor(ngo) };
}

afterEach(() => {
  jest.restoreAllMocks();
  emitToUser.mockReset();
});

describe("notification persistence reliability", () => {
  describe.each(offerRoutes)("$name", ({ path, payload, successMessage }) => {
    test("commits one offer and one compatible notification, then emits once", async () => {
      const { donor, ngo, donorAuth } = await createDonorAndNgo();
      const tracking = trackTransactions();
      const foodName = "Atomic Success Offer";
      const response = await request(app)
        .post(path)
        .set("Authorization", donorAuth)
        .send(payload(ngo._id.toString(), foodName));

      const offer = await DonationOffer.findOne({ donorId: donor._id, foodName });
      const notification = await Notification.findOne({ userId: ngo._id, requestId: offer?._id });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe(successMessage);
      expect(offer).toBeTruthy();
      expect(await DonationOffer.countDocuments({ donorId: donor._id, foodName })).toBe(1);
      expect(await Notification.countDocuments({ userId: ngo._id, requestId: offer._id })).toBe(1);
      expect(await Donation.countDocuments()).toBe(0);
      expect(await DonationRequest.countDocuments()).toBe(0);
      expect(notification).toMatchObject({
        type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
        message: "A donor offered 3 boxes of Atomic Success Offer.",
        read: false
      });
      expect(notification.createdAt).toBeInstanceOf(Date);
      if (path === "/api/requests") {
        expect(notification.donationId).toBeUndefined();
      } else {
        expect(notification.donationId?.toString()).toBe(offer._id.toString());
      }
      expect(tracking.emissions).toHaveLength(1);
      const expectedPayload = {
        id: notification._id.toString(),
        type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
        message: "A donor offered 3 boxes of Atomic Success Offer.",
        read: false,
        requestId: offer._id.toString()
      };
      if (path !== "/api/requests") {
        expectedPayload.donationId = offer._id.toString();
      }
      expect(tracking.emissions[0]).toMatchObject({
        userId: ngo._id.toString(),
        event: "notification:new",
        afterCommit: true,
        payload: expectedPayload
      });
      tracking.restore();
    });

    test("notification write failure rolls back the offer and emits nothing", async () => {
      const { donor, ngo, donorAuth } = await createDonorAndNgo();
      const tracking = trackTransactions();
      const foodName = "Atomic Failure Offer";
      jest.spyOn(Notification, "create").mockRejectedValueOnce(new Error("injected notification persistence failure"));

      const response = await request(app)
        .post(path)
        .set("Authorization", donorAuth)
        .send(payload(ngo._id.toString(), foodName));

      expect(response.status).toBe(500);
      expect(await DonationOffer.countDocuments({ donorId: donor._id, foodName })).toBe(0);
      expect(await Notification.countDocuments({ userId: ngo._id })).toBe(0);
      expect(await Donation.countDocuments()).toBe(0);
      expect(await DonationRequest.countDocuments()).toBe(0);
      expect(tracking.emissions).toHaveLength(0);
      tracking.restore();
    });
  });

  test("commit failure on request and offer creation emits no event or persisted records", async () => {
    const { donor, ngo, donorAuth, ngoAuth } = await createDonorAndNgo();
    const donation = await createDonationForUser(donor, { foodName: "Rolled Back Request" });
    const requestTracking = trackTransactions({ failCommit: true });

    const requestResponse = await request(app)
      .post("/api/requests")
      .set("Authorization", ngoAuth)
      .send({ donationId: donation._id.toString() });

    expect(requestResponse.status).toBe(500);
    expect(await DonationRequest.countDocuments({ donationId: donation._id })).toBe(0);
    expect(await Notification.countDocuments({ donationId: donation._id })).toBe(0);
    expect(requestTracking.emissions).toHaveLength(0);
    requestTracking.restore();

    const offerTracking = trackTransactions({ failCommit: true });
    const offerResponse = await request(app)
      .post("/api/offers")
      .set("Authorization", donorAuth)
      .send(offerRoutes[0].payload(ngo._id.toString(), "Rolled Back Offer"));

    expect(offerResponse.status).toBe(500);
    expect(await DonationOffer.countDocuments({ foodName: "Rolled Back Offer" })).toBe(0);
    expect(await Notification.countDocuments({ userId: ngo._id })).toBe(0);
    expect(offerTracking.emissions).toHaveLength(0);
    offerTracking.restore();
  });

  test("request, offer, and completion notifications emit only after their transaction commits", async () => {
    const { donor, ngo, donorAuth, ngoAuth } = await createDonorAndNgo();
    const tracking = trackTransactions();
    const donation = await createDonationForUser(donor, { foodName: "Commit-Timed Request" });
    const requestResponse = await request(app)
      .post("/api/requests")
      .set("Authorization", ngoAuth)
      .send({ donationId: donation._id.toString() });
    const requestId = requestResponse.body.data.id;

    await request(app).put(`/api/requests/${requestId}/accept`).set("Authorization", donorAuth);
    await request(app).put(`/api/requests/${requestId}/complete`).set("Authorization", donorAuth);
    const completionStart = tracking.emissions.length;
    await request(app).put(`/api/requests/${requestId}/complete`).set("Authorization", ngoAuth);

    const offerResponse = await request(app)
      .post("/api/offers")
      .set("Authorization", donorAuth)
      .send(offerRoutes[0].payload(ngo._id.toString(), "Commit-Timed Offer"));
    const offerId = offerResponse.body.data.id;
    await request(app).put(`/api/offers/${offerId}/accept`).set("Authorization", ngoAuth);
    await request(app).put(`/api/offers/${offerId}/complete`).set("Authorization", donorAuth);
    const offerCompletionStart = tracking.emissions.length;
    await request(app).put(`/api/offers/${offerId}/complete`).set("Authorization", ngoAuth);

    expect(requestResponse.status).toBe(201);
    expect(offerResponse.status).toBe(201);
    expect(tracking.emissions.length).toBe(8);
    expect(tracking.emissions.every((emission) => emission.afterCommit)).toBe(true);
    expect(tracking.emissions.map((emission) => emission.payload.type)).toEqual([
      NOTIFICATION_TYPES.REQUEST_RECEIVED,
      NOTIFICATION_TYPES.REQUEST_ACCEPTED,
      NOTIFICATION_TYPES.DONATION_COMPLETED,
      NOTIFICATION_TYPES.DONATION_COMPLETED,
      NOTIFICATION_TYPES.REQUEST_RECEIVED,
      NOTIFICATION_TYPES.REQUEST_ACCEPTED,
      NOTIFICATION_TYPES.DONATION_COMPLETED,
      NOTIFICATION_TYPES.DONATION_COMPLETED
    ]);
    expect(tracking.emissions.slice(completionStart, completionStart + 2)).toHaveLength(2);
    expect(tracking.emissions.slice(offerCompletionStart)).toHaveLength(2);
    tracking.restore();
  });

  test("expiry rolls back all records on notification failure and a later sweep retries", async () => {
    const { donor, ngo } = await createDonorAndNgo();
    const donation = await createDonationForUser(donor, {
      foodName: "Retryable Expiry",
      availableUntil: new Date(Date.now() - 60000)
    });
    const pendingRequest = await DonationRequest.create({
      donationId: donation._id,
      donorId: donor._id,
      ngoId: ngo._id,
      status: REQUEST_STATUS.PENDING
    });
    const failedTracking = trackTransactions();
    jest.spyOn(Notification, "create").mockRejectedValueOnce(new Error("injected expiry notification failure"));

    await expect(expireDonationsAndNotify()).rejects.toThrow("injected expiry notification failure");

    expect((await Donation.findById(donation._id)).status).toBe(DONATION_STATUS.AVAILABLE);
    expect((await DonationRequest.findById(pendingRequest._id)).status).toBe(REQUEST_STATUS.PENDING);
    expect(await Notification.countDocuments({ donationId: donation._id })).toBe(0);
    expect(failedTracking.emissions).toHaveLength(0);
    failedTracking.restore();
    jest.restoreAllMocks();
    emitToUser.mockReset();

    const retryTracking = trackTransactions();
    await expect(expireDonationsAndNotify()).resolves.toBe(1);

    const expiredDonation = await Donation.findById(donation._id);
    const rejectedRequest = await DonationRequest.findById(pendingRequest._id);
    const notification = await Notification.findOne({ userId: donor._id, donationId: donation._id });
    expect(expiredDonation.status).toBe(DONATION_STATUS.EXPIRED);
    expect(rejectedRequest.status).toBe(REQUEST_STATUS.REJECTED);
    expect(await Notification.countDocuments({ userId: donor._id, donationId: donation._id, type: NOTIFICATION_TYPES.DONATION_EXPIRED })).toBe(1);
    expect(notification).toMatchObject({
      type: NOTIFICATION_TYPES.DONATION_EXPIRED,
      message: 'Your donation "Retryable Expiry" has expired.',
      read: false
    });
    expect(retryTracking.emissions).toHaveLength(1);
    expect(retryTracking.emissions[0]).toMatchObject({
      userId: donor._id.toString(),
      event: "notification:new",
      afterCommit: true,
      payload: {
        id: notification._id.toString(),
        type: NOTIFICATION_TYPES.DONATION_EXPIRED,
        message: 'Your donation "Retryable Expiry" has expired.',
        donationId: donation._id.toString(),
        read: false
      }
    });
    retryTracking.restore();
  });

  test("a failed donation in a multi-donation sweep does not leave partial records", async () => {
    const { donor, ngo } = await createDonorAndNgo();
    const firstDonation = await createDonationForUser(donor, {
      foodName: "First Multi-Expiry",
      availableUntil: new Date(Date.now() - 60000)
    });
    const secondDonation = await createDonationForUser(donor, {
      foodName: "Second Multi-Expiry",
      availableUntil: new Date(Date.now() - 60000)
    });
    const firstRequest = await DonationRequest.create({
      donationId: firstDonation._id,
      donorId: donor._id,
      ngoId: ngo._id,
      status: REQUEST_STATUS.PENDING
    });
    const secondRequest = await DonationRequest.create({
      donationId: secondDonation._id,
      donorId: donor._id,
      ngoId: ngo._id,
      status: REQUEST_STATUS.PENDING
    });
    const tracking = trackTransactions();
    const originalCreate = Notification.create.bind(Notification);
    let notificationWrites = 0;
    jest.spyOn(Notification, "create").mockImplementation(async (...args) => {
      notificationWrites += 1;
      if (notificationWrites === 2) {
        throw new Error("injected second expiry notification failure");
      }
      return originalCreate(...args);
    });

    await expect(expireDonationsAndNotify()).rejects.toThrow("injected second expiry notification failure");

    const afterFailedSweep = await Donation.find({ _id: { $in: [firstDonation._id, secondDonation._id] } });
    const requestsAfterFailedSweep = await DonationRequest.find({ _id: { $in: [firstRequest._id, secondRequest._id] } });
    const noticesAfterFailedSweep = await Notification.find({ donationId: { $in: [firstDonation._id, secondDonation._id] } });
    expect(afterFailedSweep.filter((item) => item.status === DONATION_STATUS.EXPIRED)).toHaveLength(1);
    expect(afterFailedSweep.filter((item) => item.status === DONATION_STATUS.AVAILABLE)).toHaveLength(1);
    expect(requestsAfterFailedSweep.filter((item) => item.status === REQUEST_STATUS.REJECTED)).toHaveLength(1);
    expect(requestsAfterFailedSweep.filter((item) => item.status === REQUEST_STATUS.PENDING)).toHaveLength(1);
    expect(noticesAfterFailedSweep).toHaveLength(1);
    expect(tracking.emissions).toHaveLength(1);
    expect(tracking.emissions[0].afterCommit).toBe(true);

    tracking.restore();
    jest.restoreAllMocks();
    emitToUser.mockReset();
    const retryTracking = trackTransactions();
    await expect(expireDonationsAndNotify()).resolves.toBe(1);

    expect(await Donation.countDocuments({ _id: { $in: [firstDonation._id, secondDonation._id] }, status: DONATION_STATUS.EXPIRED })).toBe(2);
    expect(await DonationRequest.countDocuments({ _id: { $in: [firstRequest._id, secondRequest._id] }, status: REQUEST_STATUS.REJECTED })).toBe(2);
    expect(await Notification.countDocuments({ donationId: { $in: [firstDonation._id, secondDonation._id] }, type: NOTIFICATION_TYPES.DONATION_EXPIRED })).toBe(2);
    expect(retryTracking.emissions).toHaveLength(1);
    expect(retryTracking.emissions[0].afterCommit).toBe(true);
    retryTracking.restore();
  });
});
