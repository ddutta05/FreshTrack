const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const { USER_ROLES } = require("../src/utils/constants");

describe("NGO registration coordinates", () => {
  const registration = {
    email: "manual-location-ngo@test.dev",
    password: "Pass1234",
    role: USER_ROLES.NGO,
    organizationName: "Manual Location Community",
    phone: "+15550001111",
    location: "Community Center",
    acceptedCategories: ["Rice"]
  };

  test("accepts valid manually supplied GeoJSON coordinates", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        ...registration,
        geoLocation: { type: "Point", coordinates: [-73.9857, 40.7484] }
      })
      .expect(201);

    expect(response.body.data.user.role).toBe(USER_ROLES.NGO);
    expect(response.body.data.user.geoLocation).toEqual({
      type: "Point",
      coordinates: [-73.9857, 40.7484]
    });
  });

  test.each([
    ["longitude", [181, 40.7484]],
    ["latitude", [-73.9857, 91]]
  ])("rejects out-of-range manual %s without creating an account", async (_coordinate, coordinates) => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        ...registration,
        email: `invalid-${_coordinate}@test.dev`,
        geoLocation: { type: "Point", coordinates }
      })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(await User.findOne({ email: `invalid-${_coordinate}@test.dev` })).toBeNull();
  });

  test("requires a base location and does not create an NGO without coordinates", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        ...registration,
        email: "missing-location@test.dev"
      })
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(await User.findOne({ email: "missing-location@test.dev" })).toBeNull();
  });
});
