jest.mock("../src/sockets/socket", () => ({
  emitToUser: jest.fn()
}));

const request = require("supertest");
const app = require("../src/app");
const DonationRequest = require("../src/models/DonationRequest");
const Notification = require("../src/models/Notification");
const { emitToUser } = require("../src/sockets/socket");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");
const { NOTIFICATION_TYPES, REQUEST_STATUS, USER_ROLES } = require("../src/utils/constants");

beforeAll(async () => {
  await Promise.all([DonationRequest.createCollection(), Notification.createCollection()]);
});

afterEach(() => {
  jest.restoreAllMocks();
  emitToUser.mockReset();
});

describe("automatic request rejection notifications", () => {
  test("notifies only the affected NGO once and preserves both request histories", async () => {
    const donor = await createUser({ role: USER_ROLES.DONOR, name: "Auto Reject Donor" });
    const ngo1 = await createUser({ role: USER_ROLES.NGO, organizationName: "First NGO" });
    const ngo2 = await createUser({ role: USER_ROLES.NGO, organizationName: "Second NGO" });
    const unrelatedNgo = await createUser({ role: USER_ROLES.NGO, organizationName: "Unrelated NGO" });
    const donation = await createDonationForUser(donor, { foodName: "Shared Test Rice" });

    const [request1, request2] = await Promise.all([
      request(app).post("/api/requests").set("Authorization", authHeaderFor(ngo1))
        .send({ donationId: donation._id.toString(), message: "Private message one" }),
      request(app).post("/api/requests").set("Authorization", authHeaderFor(ngo2))
        .send({ donationId: donation._id.toString(), message: "Private message two" })
    ]);
    expect(request1.status).toBe(201);
    expect(request2.status).toBe(201);

    emitToUser.mockClear();
    const accepted = await request(app)
      .put(`/api/requests/${request1.body.data.id}/accept`)
      .set("Authorization", authHeaderFor(donor));

    expect(accepted.status).toBe(200);
    expect((await DonationRequest.findById(request1.body.data.id)).status).toBe(REQUEST_STATUS.ACCEPTED);
    expect((await DonationRequest.findById(request2.body.data.id)).status).toBe(REQUEST_STATUS.REJECTED);

    const rejectedNotifications = await Notification.find({
      userId: ngo2._id,
      type: NOTIFICATION_TYPES.REQUEST_REJECTED,
      requestId: request2.body.data.id
    });
    expect(rejectedNotifications).toHaveLength(1);
    expect(rejectedNotifications[0].message).toBe('Your request for "Shared Test Rice" was rejected.');
    expect(rejectedNotifications[0].donationId.toString()).toBe(donation._id.toString());

    const acceptedNotifications = await Notification.find({
      userId: ngo1._id,
      type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
      requestId: request1.body.data.id
    });
    expect(acceptedNotifications).toHaveLength(1);
    expect(await Notification.countDocuments({
      userId: ngo1._id,
      type: NOTIFICATION_TYPES.REQUEST_REJECTED,
      requestId: request2.body.data.id
    })).toBe(0);
    expect(await Notification.countDocuments({
      userId: ngo2._id,
      type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
      requestId: request1.body.data.id
    })).toBe(0);
    expect(await Notification.countDocuments({ userId: unrelatedNgo._id })).toBe(0);
    expect(await Notification.countDocuments({
      userId: ngo2._id,
      type: NOTIFICATION_TYPES.REQUEST_REJECTED,
      requestId: request2.body.data.id
    })).toBe(1);
    expect(emitToUser.mock.calls.filter(([userId, event]) => (
      userId.toString() === ngo2._id.toString() && event === "notification:new"
    ))).toHaveLength(1);

    const donorHistory = await request(app)
      .get(`/api/requests?donationId=${donation._id}`)
      .set("Authorization", authHeaderFor(donor));
    expect(donorHistory.status).toBe(200);
    expect(donorHistory.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: request1.body.data.id, status: REQUEST_STATUS.ACCEPTED }),
      expect.objectContaining({ id: request2.body.data.id, status: REQUEST_STATUS.REJECTED })
    ]));
  });

  test("rolls back acceptance and sibling rejection if rejection notification persistence fails", async () => {
    const donor = await createUser({ role: USER_ROLES.DONOR });
    const ngo1 = await createUser({ role: USER_ROLES.NGO, organizationName: "First Rollback NGO" });
    const ngo2 = await createUser({ role: USER_ROLES.NGO, organizationName: "Second Rollback NGO" });
    const donation = await createDonationForUser(donor, { foodName: "Rollback Test Rice" });

    const [request1, request2] = await Promise.all([
      request(app).post("/api/requests").set("Authorization", authHeaderFor(ngo1))
        .send({ donationId: donation._id.toString() }),
      request(app).post("/api/requests").set("Authorization", authHeaderFor(ngo2))
        .send({ donationId: donation._id.toString() })
    ]);
    expect(request1.status).toBe(201);
    expect(request2.status).toBe(201);

    const createNotification = Notification.create.bind(Notification);
    jest.spyOn(Notification, "create").mockImplementation(async (documents, options) => {
      if (documents.some((document) => document.type === NOTIFICATION_TYPES.REQUEST_REJECTED)) {
        throw new Error("injected automatic rejection notification failure");
      }
      return createNotification(documents, options);
    });
    emitToUser.mockClear();

    const accepted = await request(app)
      .put(`/api/requests/${request1.body.data.id}/accept`)
      .set("Authorization", authHeaderFor(donor));

    expect(accepted.status).toBe(500);
    expect((await DonationRequest.findById(request1.body.data.id)).status).toBe(REQUEST_STATUS.PENDING);
    expect((await DonationRequest.findById(request2.body.data.id)).status).toBe(REQUEST_STATUS.PENDING);
    expect(await Notification.countDocuments({
      requestId: { $in: [request1.body.data.id, request2.body.data.id] },
      type: { $in: [NOTIFICATION_TYPES.REQUEST_ACCEPTED, NOTIFICATION_TYPES.REQUEST_REJECTED] }
    })).toBe(0);
    expect(emitToUser).not.toHaveBeenCalled();
  });
});
