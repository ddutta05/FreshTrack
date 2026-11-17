const request = require("supertest");
const app = require("../src/app");
const env = require("../src/config/env");
const Donation = require("../src/models/Donation");
const { USER_ROLES, DONATION_STATUS } = require("../src/utils/constants");
const { createUser, authHeaderFor } = require("./helpers/factories");
const groqService = require("../src/services/groq.service");

describe("Chat recommendations", () => {
  const mockCreate = jest.fn();
  const originalNodeEnv = env.nodeEnv;
  const center = [77.5946, 12.9716];
  const near = [77.6046, 12.9716];
  let donor;
  let ngo;
  let fetchMock;

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMock.mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => mockCreate(JSON.parse(init.body))
    }));
    env.nodeEnv = "production";
    env.groqApiKey = "gsk_test_fake_groq_key_12345";
    donor = await createUser({ role: USER_ROLES.DONOR });
    donor.geoLocation = { type: "Point", coordinates: center };
    await donor.save();
    ngo = await createUser({ role: USER_ROLES.NGO });
    ngo.geoLocation = { type: "Point", coordinates: center };
    ngo.isAcceptingDonations = false;
    await ngo.save();
  });

  beforeAll(() => {
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterAll(() => {
    fetchMock.mockRestore();
    env.nodeEnv = originalNodeEnv;
  });

  function mockClassification(classification) {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          tool_calls: [{
            id: "classify-message",
            type: "function",
            function: {
              name: "classify_freshtrack_message",
              arguments: JSON.stringify({
                action: "search",
                category: null,
                maxDistanceKm: null,
                sortByDistance: false,
                distanceSortOrder: "ascending",
                reply: "",
                ...classification
              })
            }
          }]
        }
      }]
    });
  }

  async function chat(user, message, classification = {}, history = []) {
    mockClassification({
      target: user.role === USER_ROLES.DONOR ? "ngo" : "donation",
      ...classification
    });
    return request(app)
      .post("/api/ai/chat")
      .set("Authorization", authHeaderFor(user))
      .send({ message, history });
  }

  async function createNgo(name, acceptedCategories, coordinates = near) {
    const result = await createUser({
      role: USER_ROLES.NGO,
      organizationName: name,
      acceptedCategories,
      operatingRadiusKm: 30,
      isAcceptingDonations: true
    });
    result.acceptedCategories = acceptedCategories;
    result.operatingRadiusKm = 30;
    result.isAcceptingDonations = true;
    result.geoLocation = { type: "Point", coordinates };
    await result.save();
    return result;
  }

  async function createDonation(foodName, category, coordinates = near) {
    return Donation.create({
      foodName,
      category,
      quantity: "10 boxes",
      description: "Controlled test donation",
      location: "Indiranagar",
      availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      donorId: donor._id,
      status: DONATION_STATUS.AVAILABLE,
      geoLocation: { type: "Point", coordinates }
    });
  }

  test("donor searches nearby NGOs without a category and receives verified cards", async () => {
    const candidate = await createNgo("Nearby Any Food NGO", ["Any"]);

    const response = await chat(donor, "Find NGOs near me.", { sortByDistance: true });

    expect(response.status).toBe(200);
    expect(response.body.data.recommendations.map((item) => item.id)).toContain(candidate.id);
    expect(response.body.data.recommendations[0]).toMatchObject({
      type: "ngo",
      organizationName: "Nearby Any Food NGO",
      distanceKm: expect.any(Number)
    });
    expect(response.body.data.message).toContain(
      `The nearest result is ${response.body.data.recommendations[0].distanceKm} km away.`
    );
    expect(response.body.data.recommendationContext).toBeDefined();
  });

  test("donor category and distance filters return matching NGOs", async () => {
    const riceNgo = await createNgo("Nearby Rice NGO", ["Rice"]);
    await createNgo("Nearby Fruits NGO", ["Fruits"]);
    const farNgo = await createNgo("Far Rice NGO", ["Rice"], [77.8, 12.9716]);

    const distanceOnly = await chat(
      donor,
      "Find NGOs within 5 km.",
      { maxDistanceKm: 5 }
    );
    expect(distanceOnly.body.data.recommendations.map((item) => item.id)).toContain(riceNgo.id);
    expect(distanceOnly.body.data.recommendations.map((item) => item.id)).not.toContain(farNgo.id);

    const response = await chat(
      donor,
      "Find rice NGOs within 5 km.",
      { category: "Rice", maxDistanceKm: 5 }
    );
    const cards = response.body.data.recommendations;

    expect(response.status).toBe(200);
    expect(cards.map((item) => item.id)).toContain(riceNgo.id);
    expect(cards.map((item) => item.id)).not.toContain(farNgo.id);
    expect(cards.map((item) => item.organizationName)).not.toContain("Nearby Fruits NGO");
    expect(cards.every((item) => item.distanceKm <= 5)).toBe(true);
  });

  test("NGOs search available donations with optional category and radius", async () => {
    const rice = await createDonation("Available Rice Box", "Rice");
    const vegetables = await createDonation("Available Vegetable Box", "Vegetables");
    const farRice = await createDonation("Far Rice Box", "Rice", [77.8, 12.9716]);

    const anyCategory = await chat(ngo, "Find available donations.");
    expect(anyCategory.body.data.recommendations.map((item) => item.id))
      .toEqual(expect.arrayContaining([rice.id, vegetables.id]));

    const response = await chat(
      ngo,
      "Find rice within 5 km.",
      { category: "Rice", maxDistanceKm: 5 }
    );
    const cards = response.body.data.recommendations;

    expect(response.status).toBe(200);
    expect(cards.map((item) => item.id)).toContain(rice.id);
    expect(cards.map((item) => item.id)).not.toContain(farRice.id);
    expect(cards.map((item) => item.category)).toEqual(["Rice"]);
    expect(cards.every((item) => item.distanceKm <= 5)).toBe(true);
  });

  test("nearby searches return up to five real results ordered by distance", async () => {
    const closest = await createNgo("Closest NGO", ["Rice"], [77.5956, 12.9716]);
    await createNgo("Further NGO", ["Rice"], [77.5986, 12.9716]);
    await createNgo("Furthest NGO", ["Rice"], [77.6006, 12.9716]);

    const response = await chat(donor, "Show nearby NGOs.", { sortByDistance: true });
    const cards = response.body.data.recommendations;

    expect(cards.length).toBeGreaterThan(1);
    expect(cards.length).toBeLessThanOrEqual(5);
    expect(cards[0].id).toBe(closest.id);
    expect(cards.map((item) => item.distanceKm)).toEqual(
      [...cards.map((item) => item.distanceKm)].sort((a, b) => a - b)
    );
  });

  test("NGO nearby donation searches use the nearest card's distance and signed ID order", async () => {
    const farthest = await createDonation("Farther Rice", "Rice", [77.6006, 12.9716]);
    const nearest = await createDonation("Nearest Rice", "Rice", [77.5956, 12.9716]);

    const response = await chat(ngo, "Find the nearest rice donations.", {
      category: "Rice",
      sortByDistance: true,
      distanceSortOrder: "ascending"
    });
    const cards = response.body.data.recommendations;
    const context = groqService.verifyRecommendationContext(
      response.body.data.recommendationContext,
      ngo
    );

    expect(cards.map((item) => item.id)).toEqual([nearest.id, farthest.id]);
    expect(response.body.data.message).toContain(`The nearest result is ${cards[0].distanceKm} km away.`);
    expect(context.ids).toEqual(cards.map((item) => item.id));
  });

  test("donor farthest NGO search filters then returns the five farthest matching NGOs", async () => {
    const riceNgos = [];
    for (let index = 1; index <= 6; index += 1) {
      riceNgos.push(await createNgo(
        `Rice NGO ${index}`,
        ["Rice"],
        [77.5946 + index * 0.0001, 12.9716]
      ));
    }
    const fruitsNgo = await createNgo("Nearby Fruits NGO", ["Fruits"], [77.59465, 12.9716]);
    const beyondRadiusNgo = await createNgo("Distant Rice NGO", ["Rice"], [77.6046, 12.9716]);

    const response = await chat(donor, "Find the farthest rice NGOs within 0.8 km.", {
      category: "Rice",
      maxDistanceKm: 0.8,
      sortByDistance: true,
      distanceSortOrder: "descending"
    });
    const cards = response.body.data.recommendations;
    const context = groqService.verifyRecommendationContext(
      response.body.data.recommendationContext,
      donor
    );

    expect(response.status).toBe(200);
    expect(cards).toHaveLength(5);
    expect(cards.map((item) => item.id)).toEqual(riceNgos.slice(1).reverse().map((item) => item.id));
    expect(cards.map((item) => item.id)).not.toContain(fruitsNgo.id);
    expect(cards.map((item) => item.id)).not.toContain(beyondRadiusNgo.id);
    expect(cards.map((item) => item.distanceKm)).toEqual(
      [...cards.map((item) => item.distanceKm)].sort((a, b) => b - a)
    );
    expect(response.body.data.message).toContain(`The farthest result is ${cards[0].distanceKm} km away.`);
    expect(context).toMatchObject({ target: "ngo", category: "Rice", maxDistanceKm: 0.8 });
    expect(context.ids).toEqual(cards.map((item) => item.id));
  });

  test("NGO most-distant donation search filters then returns the five most distant matches", async () => {
    const riceDonations = [];
    for (let index = 1; index <= 6; index += 1) {
      riceDonations.push(await createDonation(
        `Rice Donation ${index}`,
        "Rice",
        [77.5946 + index * 0.0001, 12.9716]
      ));
    }
    const fruitsDonation = await createDonation(
      "Nearby Fruits Donation",
      "Fruits",
      [77.59465, 12.9716]
    );
    const beyondRadiusDonation = await createDonation(
      "Distant Rice Donation",
      "Rice",
      [77.6046, 12.9716]
    );

    const response = await chat(ngo, "Find the most distant rice donations within 0.8 km.", {
      category: "Rice",
      maxDistanceKm: 0.8,
      sortByDistance: true,
      distanceSortOrder: "descending"
    });
    const cards = response.body.data.recommendations;
    const context = groqService.verifyRecommendationContext(
      response.body.data.recommendationContext,
      ngo
    );

    expect(response.status).toBe(200);
    expect(cards).toHaveLength(5);
    expect(cards.map((item) => item.id)).toEqual(riceDonations.slice(1).reverse().map((item) => item.id));
    expect(cards.map((item) => item.id)).not.toContain(fruitsDonation.id);
    expect(cards.map((item) => item.id)).not.toContain(beyondRadiusDonation.id);
    expect(cards.map((item) => item.distanceKm)).toEqual(
      [...cards.map((item) => item.distanceKm)].sort((a, b) => b - a)
    );
    expect(response.body.data.message).toContain(`The farthest result is ${cards[0].distanceKm} km away.`);
    expect(context).toMatchObject({ target: "donation", category: "Rice", maxDistanceKm: 0.8 });
    expect(context.ids).toEqual(cards.map((item) => item.id));
  });

  test("category-changing follow-up is classified with recent conversation history", async () => {
    const rice = await createDonation("Rice Donation", "Rice");
    const vegetables = await createDonation("Vegetable Donation", "Vegetables");
    const first = await chat(ngo, "Find rice donations.", { category: "Rice" });
    const history = [
      { role: "user", content: "Find rice donations." },
      {
        role: "assistant",
        content: first.body.data.message,
        recommendationContext: first.body.data.recommendationContext
      }
    ];

    const followUp = await chat(
      ngo,
      "What about vegetables instead?",
      { category: "Vegetables" },
      history
    );

    expect(followUp.status).toBe(200);
    expect(followUp.body.data.recommendations.map((item) => item.id)).toEqual([vegetables.id]);
    expect(followUp.body.data.recommendations.map((item) => item.id)).not.toContain(rice.id);
    const modelMessages = mockCreate.mock.calls.at(-1)[0].messages;
    expect(modelMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "user", content: "Find rice donations." }),
      expect.objectContaining({ role: "user", content: "What about vegetables instead?" })
    ]));
  });

  test("donor category-changing follow-up returns matching NGOs and signed IDs", async () => {
    const riceNgo = await createNgo("Follow-up Rice NGO", ["Rice"]);
    const fruitsNgo = await createNgo("Follow-up Fruits NGO", ["Fruits"]);
    const first = await chat(donor, "Find NGOs accepting rice.", { category: "Rice" });
    const history = [
      { role: "user", content: "Find NGOs accepting rice." },
      {
        role: "assistant",
        content: first.body.data.message,
        recommendationContext: first.body.data.recommendationContext
      }
    ];

    const followUp = await chat(
      donor,
      "What about fruits instead?",
      { category: "Fruits" },
      history
    );
    const cards = followUp.body.data.recommendations;
    const context = groqService.verifyRecommendationContext(
      followUp.body.data.recommendationContext,
      donor
    );

    expect(followUp.status).toBe(200);
    expect(cards.map((item) => item.id)).toEqual([fruitsNgo.id]);
    expect(cards.map((item) => item.id)).not.toContain(riceNgo.id);
    expect(context.ids).toEqual(cards.map((item) => item.id));
  });

  test("signed recommendation context is tied to its cards, user, and expiry", async () => {
    const candidate = await createNgo("Signed Context NGO", ["Rice"]);
    const response = await chat(donor, "Find Rice NGOs.", { category: "Rice" });
    const cards = response.body.data.recommendations;
    const context = groqService.verifyRecommendationContext(
      response.body.data.recommendationContext,
      donor
    );

    expect(cards.map((item) => item.id)).toEqual([candidate.id]);
    expect(context.ids).toEqual(cards.map((item) => item.id));
    expect(context).toMatchObject({ target: "ngo", category: "Rice" });
    expect(groqService.verifyRecommendationContext(
      response.body.data.recommendationContext,
      ngo
    )).toBeNull();
  });

  test("rejects a recommendation context with a tampered signature", () => {
    const token = groqService.signRecommendationContext(
      [],
      { target: "ngo", category: "Rice", maxDistanceKm: 10 },
      donor
    );
    const [encoded, signature] = token.split(".");
    const changedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    expect(groqService.verifyRecommendationContext(`${encoded}.${changedSignature}`, donor)).toBeNull();
  });

  test("rejects a validly signed context belonging to another user", async () => {
    const otherDonor = await createUser({ role: USER_ROLES.DONOR });
    const token = groqService.signRecommendationContext(
      [],
      { target: "ngo", category: "Rice", maxDistanceKm: 10 },
      donor
    );

    expect(groqService.verifyRecommendationContext(token, otherDonor)).toBeNull();
  });

  test("rejects an expired signed recommendation context", () => {
    const now = Date.now();
    const dateNow = jest.spyOn(Date, "now").mockReturnValue(now - 2 * 60 * 60 * 1000 - 1);
    let token;
    try {
      token = groqService.signRecommendationContext(
        [],
        { target: "ngo", category: "Rice", maxDistanceKm: 10 },
        donor
      );
    } finally {
      dateNow.mockRestore();
    }

    expect(groqService.verifyRecommendationContext(token, donor)).toBeNull();
  });

  test("ignores recommendation context on user history and accepts assistant history context", () => {
    const token = groqService.signRecommendationContext(
      [],
      { target: "ngo", category: "Rice", maxDistanceKm: 10 },
      donor
    );

    expect(groqService.latestRecommendationContext([
      { role: "user", content: "Find Rice NGOs.", recommendationContext: token }
    ], donor)).toBeNull();
    expect(groqService.latestRecommendationContext([
      { role: "assistant", content: "Here are verified NGOs.", recommendationContext: token }
    ], donor)).toMatchObject({
      userId: donor.id,
      role: USER_ROLES.DONOR,
      target: "ngo",
      category: "Rice",
      maxDistanceKm: 10,
      ids: []
    });
  });
});
