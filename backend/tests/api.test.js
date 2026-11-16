const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/freshtrack-test";

const app = require("../src/app");
const Donation = require("../src/models/Donation");
const DonationRequest = require("../src/models/DonationRequest");
const Notification = require("../src/models/Notification");
const User = require("../src/models/User");
const {
  USER_ROLES,
  USER_STATUS,
  DONATION_STATUS,
  REQUEST_STATUS
} = require("../src/utils/constants");
const env = require("../src/config/env");
const { createUser, authHeaderFor, createDonationForUser } = require("./helpers/factories");

describe("FreshTrack Backend API", () => {
  test("health endpoint reports running status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("FreshTrack API is running");
    expect(["connected", "connecting", "disconnected"]).toContain(res.body.database);
  });

  describe("Auth", () => {
    test("registers user", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "John",
        email: "john@test.dev",
        password: "Pass1234",
        role: USER_ROLES.DONOR
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("john@test.dev");
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.token).toBeTruthy();

      const decoded = jwt.verify(res.body.data.token, env.jwtSecret);
      expect(decoded.userId).toBeTruthy();
      expect(decoded.role).toBe(USER_ROLES.DONOR);
      expect(decoded.password).toBeUndefined();
    });

    test("registers NGO without personal name", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "ngo-noname@test.dev",
        password: "Pass1234",
        role: USER_ROLES.NGO,
        organizationName: "Community Relief",
        phone: "+15550001111",
        location: "Community Center",
        geoLocation: { type: "Point", coordinates: [-73.9857, 40.7484] },
        acceptedCategories: ["Rice"]
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(USER_ROLES.NGO);
      expect(res.body.data.user.organizationName).toBe("Community Relief");
      expect(res.body.data.user.name).toBe("Community Relief");
    });

    test("prevents duplicate email", async () => {
      await createUser({ email: "dupe@test.dev" });
      const res = await request(app).post("/api/auth/register").send({
        name: "Dupe",
        email: "dupe@test.dev",
        password: "Pass1234",
        role: USER_ROLES.DONOR
      });

      expect(res.status).toBe(409);
    });

    test("login rejects invalid password", async () => {
      await createUser({ email: "login@test.dev", password: "Pass1234" });
      const res = await request(app).post("/api/auth/login").send({
        email: "login@test.dev",
        password: "Wrong123",
        role: USER_ROLES.DONOR
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid credentials");
    });

    test("disabled account cannot login", async () => {
      await createUser({
        email: "disabled@test.dev",
        password: "Pass1234",
        status: USER_STATUS.DISABLED
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "disabled@test.dev",
        password: "Pass1234",
        role: USER_ROLES.DONOR
      });

      expect(res.status).toBe(403);
    });

    test("returns current user via /me", async () => {
      const user = await createUser({ role: USER_ROLES.NGO, organizationName: "Hope Kitchen" });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", authHeaderFor(user));

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(USER_ROLES.NGO);
      expect(res.body.data.organizationName).toBe("Hope Kitchen");
    });

    test("returns a user-friendly message for invalid resource ids", async () => {
      const res = await request(app).get("/api/donations/not-a-valid-id");

      expect(res.status).toBe(422);
      expect(res.body.message).toBe("We couldn't find that item.");
    });

    test("protected endpoint rejects missing jwt", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    test("protected endpoint rejects invalid jwt", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer not-a-real-token");
      expect(res.status).toBe(401);
    });

    test("protected endpoint rejects expired jwt", async () => {
      const user = await createUser({ role: USER_ROLES.DONOR });
      const expiredToken = jwt.sign(
        { userId: user._id.toString(), role: user.role },
        env.jwtSecret,
        { expiresIn: -1 }
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    test("disabled user with old jwt is blocked from protected endpoints", async () => {
      const user = await createUser({ role: USER_ROLES.DONOR });
      const token = authHeaderFor(user);

      await User.findByIdAndUpdate(user._id, { status: USER_STATUS.DISABLED });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", token);

      expect(res.status).toBe(403);
    });
  });

  describe("Authorization", () => {
    test("donor cannot access NGO-only request creation endpoint", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const donor2 = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(donor2);

      const res = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(donor))
        .send({ donationId: donation._id.toString(), message: "Need this" });

      expect(res.status).toBe(403);
    });

    test("ngo cannot access admin endpoint", async () => {
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Aid Org" });
      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", authHeaderFor(ngo));

      expect(res.status).toBe(403);
    });

    test("donor cannot update another donor donation", async () => {
      const donorA = await createUser({ role: USER_ROLES.DONOR });
      const donorB = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(donorA);

      const res = await request(app)
        .put(`/api/donations/${donation._id}`)
        .set("Authorization", authHeaderFor(donorB))
        .send({ foodName: "Changed" });

      expect(res.status).toBe(403);
    });
  });

  describe("Donations", () => {
    test("create, update and delete donation", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });

      const createRes = await request(app)
        .post("/api/donations")
        .set("Authorization", authHeaderFor(donor))
        .send({
          foodName: "Rice Box",
          category: "Rice",
          quantity: "5 kg",
          description: "Fresh rice",
          image: "https://example.com/rice.jpg",
          location: "Dhaka",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(createRes.status).toBe(201);
      const donationId = createRes.body.data.id;

      const updateRes = await request(app)
        .put(`/api/donations/${donationId}`)
        .set("Authorization", authHeaderFor(donor))
        .send({ location: "Chittagong" });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.location).toBe("Chittagong");

      const deleteRes = await request(app)
        .delete(`/api/donations/${donationId}`)
        .set("Authorization", authHeaderFor(donor));

      expect(deleteRes.status).toBe(200);
    });

    test("lists and filters donations", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      await createDonationForUser(donor, { foodName: "Mango", category: "Fruits", location: "Dhaka" });
      await createDonationForUser(donor, { foodName: "Bread", category: "Bakery", location: "Khulna" });

      const res = await request(app).get("/api/donations?category=Fruits");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].category).toBe("Fruits");
    });

    test("returns paginated donations payload when page/limit supplied", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      await createDonationForUser(donor, { foodName: "A" });
      await createDonationForUser(donor, { foodName: "B" });
      await createDonationForUser(donor, { foodName: "C" });

      const res = await request(app).get("/api/donations?page=1&limit=2");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(3);
    });

    test("marks expired donations when queried", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(donor, {
        availableUntil: new Date(Date.now() + 3600000),
        status: DONATION_STATUS.AVAILABLE
      });

      await Donation.findByIdAndUpdate(donation._id, {
        availableUntil: new Date(Date.now() - 1000),
        status: DONATION_STATUS.AVAILABLE
      });

      const res = await request(app).get("/api/donations");
      const found = res.body.data.find((d) => d.id === donation._id.toString());
      expect(found.status).toBe(DONATION_STATUS.EXPIRED);
    });
  });

  describe("Requests lifecycle", () => {
    test("ngo creates request and duplicate active request is prevented", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Hope" });
      const donation = await createDonationForUser(donor);

      const first = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Please accept" });

      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Again" });

      expect(second.status).toBe(409);

      const refreshedDonation = await Donation.findById(donation._id);
      expect(refreshedDonation.status).toBe(DONATION_STATUS.AVAILABLE);

      const requestableList = await request(app)
        .get("/api/donations?availability=requestable")
        .set("Authorization", authHeaderFor(ngo));

      expect(requestableList.status).toBe(200);
      expect(requestableList.body.data.some((d) => d.id === donation._id.toString())).toBe(true);
    });

    test("donor accepts then both parties confirm completion", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Help NGO" });
      const donation = await createDonationForUser(donor);

      const createRes = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Need it" });

      const reqId = createRes.body.data.id;

      const acceptRes = await request(app)
        .put(`/api/requests/${reqId}/accept`)
        .set("Authorization", authHeaderFor(donor));

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe(REQUEST_STATUS.ACCEPTED);

      const completeRes = await request(app)
        .put(`/api/requests/${reqId}/complete`)
        .set("Authorization", authHeaderFor(ngo));

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe(REQUEST_STATUS.ACCEPTED);
      expect(completeRes.body.data.ngoCompletedAt).toBeTruthy();

      const donorCompleteRes = await request(app)
        .put(`/api/requests/${reqId}/complete`)
        .set("Authorization", authHeaderFor(donor));

      expect(donorCompleteRes.status).toBe(200);
      expect(donorCompleteRes.body.data.status).toBe(REQUEST_STATUS.COMPLETED);

      const updatedDonation = await Donation.findById(donation._id);
      expect(updatedDonation.status).toBe(DONATION_STATUS.COMPLETED);
    });

    test("direct offer creates a DonationOffer without creating a Donation or DonationRequest", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Target NGO" });
      const beforeDonationCount = await Donation.countDocuments();
      const beforeRequestCount = await require("../src/models/DonationRequest").countDocuments();
      const beforeOfferCount = await require("../src/models/DonationOffer").countDocuments();

      const result = await request(app)
        .post("/api/offers")
        .set("Authorization", authHeaderFor(donor))
        .send({
          ngoId: ngo._id.toString(),
          foodName: "Chocolates",
          category: "Chocolates",
          quantity: "3 boxes",
          description: "Direct offer",
          location: "Community Hall",
          availableUntil: new Date(Date.now() + 86400000).toISOString()
        });

      expect(result.status).toBe(201);
      expect(result.body.data.targetNgoId).toBe(ngo._id.toString());
      expect(result.body.data.direction).toBe("donor_offer");
      expect(await Donation.countDocuments()).toBe(beforeDonationCount);
      expect(await require("../src/models/DonationRequest").countDocuments()).toBe(beforeRequestCount);
      expect(await require("../src/models/DonationOffer").countDocuments()).toBe(beforeOfferCount + 1);
    });

    test("dedicated offers endpoint validates provided dates and preserves its omitted-date default", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Date Validation NGO" });
      const payload = {
        ngoId: ngo._id.toString(),
        foodName: "Date validation offer",
        category: "Rice",
        quantity: "4 trays",
        description: "Date validation test",
        location: "Community Hall"
      };

      const malformed = await request(app)
        .post("/api/offers")
        .set("Authorization", authHeaderFor(donor))
        .send({ ...payload, availableUntil: "not-a-date" });
      expect(malformed.status).toBe(422);
      expect(malformed.body.error.code).toBe("INVALID_AVAILABLE_UNTIL");

      const malformedBoolean = await request(app)
        .post("/api/offers")
        .set("Authorization", authHeaderFor(donor))
        .send({ ...payload, availableUntil: false });
      expect(malformedBoolean.status).toBe(422);
      expect(malformedBoolean.body.error.code).toBe("INVALID_AVAILABLE_UNTIL");

      const past = await request(app)
        .post("/api/offers")
        .set("Authorization", authHeaderFor(donor))
        .send({ ...payload, availableUntil: new Date(Date.now() - 60000).toISOString() });
      expect(past.status).toBe(422);
      expect(past.body.error.code).toBe("INVALID_AVAILABLE_UNTIL");

      const future = await request(app)
        .post("/api/offers")
        .set("Authorization", authHeaderFor(donor))
        .send({ ...payload, availableUntil: new Date(Date.now() + 86400000).toISOString() });
      expect(future.status).toBe(201);
      const futureOffer = await require("../src/models/DonationOffer").findById(future.body.data.id);
      expect(futureOffer.availableUntil.getTime()).toBeGreaterThan(Date.now());

      const omitted = await request(app)
        .post("/api/offers")
        .set("Authorization", authHeaderFor(donor))
        .send(payload);
      expect(omitted.status).toBe(201);
      const defaultedOffer = await require("../src/models/DonationOffer").findById(omitted.body.data.id);
      expect(defaultedOffer.availableUntil.getTime()).toBeGreaterThan(Date.now());
    });

    test("donor can create a direct NGO offer and both parties can complete it", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Offer NGO" });

      const offer = await request(app)
        .post("/api/offers")
        .set("Authorization", authHeaderFor(donor))
        .send({ ngoId: ngo._id.toString(), foodName: "Chocolates", category: "Chocolates", quantity: "5 boxes", message: "For the children" });

      expect(offer.status).toBe(201);
      expect(offer.body.data.direction).toBe("donor_offer");
      expect(offer.body.data.foodName).toBe("Chocolates");

      const accept = await request(app)
        .put(`/api/offers/${offer.body.data.id}/accept`)
        .set("Authorization", authHeaderFor(ngo));
      expect(accept.status).toBe(200);

      const firstComplete = await request(app)
        .put(`/api/offers/${offer.body.data.id}/complete`)
        .set("Authorization", authHeaderFor(ngo));
      expect(firstComplete.body.data.status).toBe(REQUEST_STATUS.ACCEPTED);

      const secondComplete = await request(app)
        .put(`/api/offers/${offer.body.data.id}/complete`)
        .set("Authorization", authHeaderFor(donor));
      expect(secondComplete.body.data.status).toBe(REQUEST_STATUS.COMPLETED);
    });

    test("unrelated users cannot confirm completion", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO });
      const stranger = await createUser({ role: USER_ROLES.DONOR });
      const donation = await createDonationForUser(donor);
      const created = await request(app).post("/api/requests").set("Authorization", authHeaderFor(ngo)).send({ donationId: donation._id.toString() });
      await request(app).put(`/api/requests/${created.body.data.id}/accept`).set("Authorization", authHeaderFor(donor));
      const result = await request(app).put(`/api/requests/${created.body.data.id}/complete`).set("Authorization", authHeaderFor(stranger));
      expect(result.status).toBe(403);
    });

    test("competing requests allow only one accepted", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngoA = await createUser({ role: USER_ROLES.NGO, organizationName: "NGO A" });
      const ngoB = await createUser({ role: USER_ROLES.NGO, organizationName: "NGO B" });
      const donation = await createDonationForUser(donor);

      const first = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngoA))
        .send({ donationId: donation._id.toString(), message: "A" });

      const second = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngoB))
        .send({ donationId: donation._id.toString(), message: "B" });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      const acceptFirst = await request(app)
        .put(`/api/requests/${first.body.data.id}/accept`)
        .set("Authorization", authHeaderFor(donor));

      expect(acceptFirst.status).toBe(200);

      const acceptSecond = await request(app)
        .put(`/api/requests/${second.body.data.id}/accept`)
        .set("Authorization", authHeaderFor(donor));

      expect(acceptSecond.status).toBe(409);
    });

    test("invalid transition rejected->accepted fails", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Aid" });
      const donation = await createDonationForUser(donor);

      const createRes = await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Need it" });

      const reqId = createRes.body.data.id;

      const rejectRes = await request(app)
        .put(`/api/requests/${reqId}/reject`)
        .set("Authorization", authHeaderFor(donor));

      expect(rejectRes.status).toBe(200);

      const invalidAccept = await request(app)
        .put(`/api/requests/${reqId}/accept`)
        .set("Authorization", authHeaderFor(donor));

      expect(invalidAccept.status).toBe(409);
    });
  });

  describe("Notifications", () => {
    test("notification created and only owner can read", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Hope" });
      const other = await createUser({ role: USER_ROLES.NGO, organizationName: "Other" });
      const donation = await createDonationForUser(donor);

      await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Please" });

      const donorNotifs = await request(app)
        .get("/api/notifications")
        .set("Authorization", authHeaderFor(donor));

      expect(donorNotifs.status).toBe(200);
      expect(donorNotifs.body.data.length).toBeGreaterThan(0);

      const notificationId = donorNotifs.body.data[0].id;

      const forbiddenRead = await request(app)
        .post(`/api/notifications/${notificationId}/read`)
        .set("Authorization", authHeaderFor(other));

      expect(forbiddenRead.status).toBe(403);

      const ownRead = await request(app)
        .post(`/api/notifications/${notificationId}/read`)
        .set("Authorization", authHeaderFor(donor));

      expect(ownRead.status).toBe(200);
    });

    test("unread count and read-all work", async () => {
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Hope" });
      const donation = await createDonationForUser(donor);

      await request(app)
        .post("/api/requests")
        .set("Authorization", authHeaderFor(ngo))
        .send({ donationId: donation._id.toString(), message: "Please" });

      const countBefore = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", authHeaderFor(donor));

      expect(countBefore.status).toBe(200);
      expect(countBefore.body.data.unreadCount).toBeGreaterThan(0);

      const markAll = await request(app)
        .put("/api/notifications/read-all")
        .set("Authorization", authHeaderFor(donor));

      expect(markAll.status).toBe(200);

      const countAfter = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", authHeaderFor(donor));

      expect(countAfter.status).toBe(200);
      expect(countAfter.body.data.unreadCount).toBe(0);
    });
  });

  describe("Admin", () => {
    test("list users, disable/enable and stats", async () => {
      const admin = await createUser({ role: USER_ROLES.ADMIN, email: "admin@test.dev" });
      const donor = await createUser({ role: USER_ROLES.DONOR });
      const ngo = await createUser({ role: USER_ROLES.NGO, organizationName: "Help" });
      const donation = await createDonationForUser(donor);

      await DonationRequest.create({
        donationId: donation._id,
        ngoId: ngo._id,
        status: REQUEST_STATUS.PENDING,
        message: "Need"
      });

      const usersRes = await request(app)
        .get("/api/users")
        .set("Authorization", authHeaderFor(admin));

      expect(usersRes.status).toBe(200);
      expect(Array.isArray(usersRes.body.data)).toBe(true);

      const disableRes = await request(app)
        .put(`/api/users/${donor._id}/disable`)
        .set("Authorization", authHeaderFor(admin));

      expect(disableRes.status).toBe(200);

      const enableRes = await request(app)
        .put(`/api/users/${donor._id}/enable`)
        .set("Authorization", authHeaderFor(admin));

      expect(enableRes.status).toBe(200);

      const statsRes = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", authHeaderFor(admin));

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalUsers).toBeGreaterThanOrEqual(3);
      expect(statsRes.body.data.totalDonations).toBeGreaterThanOrEqual(1);
      expect(statsRes.body.data.totalRequests).toBeGreaterThanOrEqual(1);
    });
  });
});
