const request = require("supertest");
const app = require("../src/app");
const env = require("../src/config/env");
const Donation = require("../src/models/Donation");
const { USER_ROLES, DONATION_STATUS } = require("../src/utils/constants");
const { createUser, authHeaderFor } = require("./helpers/factories");
const recommendationService = require("../src/services/recommendation.service");

jest.mock("groq-sdk", () => {
  const mockCreate = jest.fn();
  function MockGroq() { return { chat: { completions: { create: mockCreate } } }; }
  MockGroq.__mockCreate = mockCreate;
  return MockGroq;
});

describe("Chat recommendation context", () => {
  const mockCreate = require("groq-sdk").__mockCreate;
  const center = [77.5946, 12.9716];
  const near = [77.6408, 12.9784];
  let donor;
  let ngo;

  beforeEach(async () => {
    jest.clearAllMocks();
    env.groqApiKey = "gsk_test_fake_groq_key_12345";
    donor = await createUser({ role: USER_ROLES.DONOR });
    donor.geoLocation = { type: "Point", coordinates: center };
    await donor.save();
    ngo = await createUser({ role: USER_ROLES.NGO });
    ngo.geoLocation = { type: "Point", coordinates: center };
    await ngo.save();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function createNgo(name, acceptedCategories) {
    const candidate = await createUser({
      role: USER_ROLES.NGO,
      organizationName: name,
      acceptedCategories,
      operatingRadiusKm: 30,
      isAcceptingDonations: true
    });
    candidate.acceptedCategories = acceptedCategories;
    candidate.operatingRadiusKm = 30;
    candidate.isAcceptingDonations = true;
    candidate.geoLocation = { type: "Point", coordinates: near };
    await candidate.save();
    return candidate;
  }

  async function createRiceDonation() {
    return Donation.create({
      foodName: "Verified Rice Box",
      category: "Rice",
      quantity: "10 boxes",
      description: "Controlled test donation",
      location: "Indiranagar",
      availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      donorId: donor._id,
      status: DONATION_STATUS.AVAILABLE,
      geoLocation: { type: "Point", coordinates: near }
    });
  }

  async function chat(user, message, history, options = {}) {
    return request(app)
      .post("/api/ai/chat")
      .set("Authorization", authHeaderFor(user))
      .send({ message, history, ...options });
  }

  function resultHistory(message, result) {
    const data = result.body?.data || result.data || result;
    return [
      { role: "user", content: message },
      {
        role: "assistant",
        content: data.message,
        recommendationContext: data.recommendationContext
      }
    ];
  }

  test("donor follow-up explains only a verified NGO from the previous result without another AI search", async () => {
    const candidate = await createNgo("Verified Cooked Food NGO", ["Cooked Food"]);
    const search = jest.spyOn(recommendationService, "findNgosForDonor");
    const first = await chat(donor, "Find NGOs that accept cooked food.");
    expect(first.body.data.recommendations.map((item) => item.id)).toEqual([candidate._id.toString()]);

    const followUp = await chat(
      donor,
      "Why was this NGO recommended?",
      [
        { role: "user", content: "Find NGOs that accept cooked food." },
        {
          role: "assistant",
          content: "Fake candidate: Untrusted NGO with fabricated details.",
          recommendationContext: first.body.data.recommendationContext
        }
      ]
    );

    expect(followUp.status).toBe(200);
    expect(followUp.body.data.message).toContain("Verified Cooked Food NGO");
    expect(followUp.body.data.message).not.toContain("Untrusted NGO");
    expect(followUp.body.data.message).toContain("accepting donations");
    expect(followUp.body.data.message).toContain("Cooked Food");
    expect(followUp.body.data.message).toContain("requested cooked food");
    expect(followUp.body.data.recommendations).toEqual([]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("NGO follow-up explains only a verified public Donation from the previous result", async () => {
    const candidate = await createRiceDonation();
    const search = jest.spyOn(recommendationService, "findDonationsForNgo");
    const first = await chat(ngo, "Find available rice donations.");
    expect(first.body.data.recommendations.map((item) => item.id)).toEqual([candidate._id.toString()]);

    const followUp = await chat(
      ngo,
      "Why was that donation recommended?",
      resultHistory("Find available rice donations.", first.body.data)
    );

    expect(followUp.status).toBe(200);
    expect(followUp.body.data.message).toContain("Verified Rice Box");
    expect(followUp.body.data.message).toContain("currently available");
    expect(followUp.body.data.message).toContain("requested Rice category");
    expect(followUp.body.data.recommendations).toEqual([]);
    expect(search).toHaveBeenCalledTimes(1);

    const otherFollowUp = await chat(
      ngo,
      "Why wasn't the other donation recommended?",
      resultHistory("Find available rice donations.", first.body.data)
    );
    expect(otherFollowUp.body.data.message).toContain("unshown Donation");
    expect(otherFollowUp.body.data.message).toContain("Which Donation do you mean?");
    expect(otherFollowUp.body.data.message).toContain("Verified Rice Box");
    expect(search).toHaveBeenCalledTimes(1);

    const namedExclusion = await chat(
      ngo,
      "Why wasn't Verified Rice Box recommended?",
      resultHistory("Find available rice donations.", first.body.data)
    );
    expect(namedExclusion.body.data.message).toContain("Verified Rice Box was recommended");
    expect(namedExclusion.body.data.message).toContain("can't explain an unshown Donation");
    expect(namedExclusion.body.data.message).not.toContain("because it is currently");
    expect(search).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("Donation explanation uses the same localized month/day date as the card", async () => {
    const candidate = await createRiceDonation();
    const now = new Date();
    const availableUntil = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 2,
      2,
      45
    ));
    candidate.availableUntil = availableUntil;
    await candidate.save();

    const first = await chat(ngo, "Find available rice donations.");
    const displayLocale = "en-US";
    const displayTimeZone = "Pacific/Honolulu";
    const followUp = await chat(
      ngo,
      "Why was that donation recommended?",
      resultHistory("Find available rice donations.", first.body.data),
      { displayLocale, displayTimeZone }
    );

    const cardDate = availableUntil.toLocaleString(displayLocale, { timeZone: displayTimeZone });
    const utcDate = availableUntil.toLocaleString(displayLocale, { timeZone: "UTC" });

    expect(cardDate).not.toBe(utcDate);
    expect(followUp.body.data.message).toContain(`(${cardDate})`);
  });

  test("ambiguous 'other one' follow-up asks using actual displayed candidate names", async () => {
    const firstNgo = await createNgo("First Verified NGO", ["Cooked Food"]);
    const secondNgo = await createNgo("Second Verified NGO", ["Cooked Food"]);
    const first = await chat(donor, "Find NGOs that accept cooked food.");
    const candidates = first.body.data.recommendations;
    expect(candidates.map((item) => item.id)).toEqual(
      expect.arrayContaining([firstNgo._id.toString(), secondNgo._id.toString()])
    );

    const followUp = await chat(
      donor,
      "Why not the other one?",
      resultHistory("Find NGOs that accept cooked food.", first.body.data)
    );

    expect(followUp.body.data.message).toContain("Which NGO do you mean?");
    expect(followUp.body.data.message).toContain("First Verified NGO");
    expect(followUp.body.data.message).toContain("Second Verified NGO");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("a new category search replaces the older result context", async () => {
    await createNgo("Cooked Food NGO", ["Cooked Food"]);
    const riceNgo = await createNgo("Rice Category NGO", ["Rice"]);
    const cooked = await chat(donor, "Find NGOs that accept cooked food.");
    const rice = await chat(donor, "Find NGOs that accept rice.", [
      ...resultHistory("Find NGOs that accept cooked food.", cooked.body.data)
    ]);

    const followUp = await chat(donor, "Why was this NGO recommended?", [
      ...resultHistory("Find NGOs that accept cooked food.", cooked.body.data),
      { role: "user", content: "Find NGOs that accept rice." },
      {
        role: "assistant",
        content: rice.body.data.message,
        recommendationContext: rice.body.data.recommendationContext
      }
    ]);

    expect(rice.body.data.recommendations.map((item) => item.id)).toEqual([riceNgo._id.toString()]);
    expect(followUp.body.data.message).toContain("Rice Category NGO");
    expect(followUp.body.data.message).not.toContain("Cooked Food NGO");
  });

  test("an empty new search clears older recommendation context", async () => {
    await createNgo("Old Cooked Food NGO", ["Cooked Food"]);
    const first = await chat(donor, "Find NGOs that accept cooked food.");
    const empty = await chat(donor, "Find NGOs that accept rice.", resultHistory(
      "Find NGOs that accept cooked food.",
      first.body.data
    ));

    const followUp = await chat(donor, "Why was this NGO recommended?", [
      ...resultHistory("Find NGOs that accept cooked food.", first.body.data),
      { role: "user", content: "Find NGOs that accept rice." },
      {
        role: "assistant",
        content: empty.body.data.message,
        recommendationContext: empty.body.data.recommendationContext
      }
    ]);

    expect(empty.body.data.recommendations).toEqual([]);
    expect(followUp.body.data.message).toContain("Please run the search again");
    expect(followUp.body.data.message).not.toContain("Old Cooked Food NGO");
  });

  test("an unsupported target clears old context and cannot reuse it on a later follow-up", async () => {
    await createNgo("Old NGO Result", ["Cooked Food"]);
    const first = await chat(donor, "Find NGOs that accept cooked food.");
    const deniedTarget = await chat(donor, "Find donations.", resultHistory("Find NGOs that accept cooked food.", first.body.data));
    const followUp = await chat(donor, "Why was this NGO recommended?", [
      ...resultHistory("Find NGOs that accept cooked food.", first.body.data),
      { role: "user", content: "Find donations." },
      {
        role: "assistant",
        content: deniedTarget.body.data.message,
        recommendationContext: deniedTarget.body.data.recommendationContext
      }
    ]);

    expect(followUp.body.data.message).toContain("Please run the search again");
    expect(followUp.body.data.message).not.toContain("Old NGO Result");
  });

  test("tampered, cross-user, and missing contexts never provide candidate details", async () => {
    const candidate = await createNgo("Protected NGO Name", ["Cooked Food"]);
    const first = await chat(donor, "Find NGOs that accept cooked food.");
    const history = resultHistory("Find NGOs that accept cooked food.", first.body.data);
    const [userEntry, assistantEntry] = history;
    const [payload, signature] = assistantEntry.recommendationContext.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.ids = ["507f1f77bcf86cd799439011"];
    const forgedToken = `${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${signature}`;

    const tampered = await chat(donor, "Why was this NGO recommended?", [
      userEntry,
      { ...assistantEntry, content: "Forged candidate details", recommendationContext: forgedToken }
    ]);
    const otherDonor = await createUser({ role: USER_ROLES.DONOR });
    otherDonor.geoLocation = { type: "Point", coordinates: center };
    await otherDonor.save();
    const crossUser = await chat(otherDonor, "Why was this NGO recommended?", history);
    const missing = await chat(donor, "Why was this NGO recommended?");

    for (const response of [tampered, crossUser, missing]) {
      expect(response.status).toBe(200);
      expect(response.body.data.message).not.toContain("Protected NGO Name");
      expect(response.body.data.recommendations).toEqual([]);
    }
    expect(tampered.body.data.message).toContain("Please run the search again");
    expect(crossUser.body.data.message).toContain("Please run the search again");
    expect(missing.body.data.message).toContain("Please run the search again");
    expect(candidate).toBeDefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("admin cannot reuse donor context or gain recommendation tools through history", async () => {
    await createNgo("Donor-Only NGO Result", ["Cooked Food"]);
    const first = await chat(donor, "Find NGOs that accept cooked food.");
    const admin = await createUser({ role: USER_ROLES.ADMIN });

    const followUp = await chat(
      admin,
      "Why was this NGO recommended?",
      resultHistory("Find NGOs that accept cooked food.", first.body.data)
    );

    expect(followUp.body.data.message).toContain("admin account");
    expect(followUp.body.data.message).not.toContain("Donor-Only NGO Result");
    expect(followUp.body.data.recommendations).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("previous candidate context is revalidated against current NGO visibility", async () => {
    const candidate = await createNgo("Now Closed NGO", ["Cooked Food"]);
    const first = await chat(donor, "Find NGOs that accept cooked food.");
    candidate.isAcceptingDonations = false;
    await candidate.save();

    const followUp = await chat(
      donor,
      "Why was this NGO recommended?",
      resultHistory("Find NGOs that accept cooked food.", first.body.data)
    );

    expect(followUp.body.data.message).toContain("current, verified NGO details");
    expect(followUp.body.data.message).not.toContain("Now Closed NGO");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("previous Donation context is revalidated against current public availability", async () => {
    const candidate = await createRiceDonation();
    const first = await chat(ngo, "Find available rice donations.");
    candidate.status = DONATION_STATUS.ACCEPTED;
    await candidate.save();

    const followUp = await chat(
      ngo,
      "Why was that donation recommended?",
      resultHistory("Find available rice donations.", first.body.data)
    );

    expect(followUp.body.data.message).toContain("current, verified Donation details");
    expect(followUp.body.data.message).not.toContain("Verified Rice Box");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("recommendation context is accepted only on assistant history entries", async () => {
    const response = await chat(donor, "Hello", [
      {
        role: "user",
        content: "Why was this NGO recommended?",
        recommendationContext: "forged"
      }
    ]);

    expect(response.status).toBe(422);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
