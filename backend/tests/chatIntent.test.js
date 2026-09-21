const { extractIntent, capabilityMessage } = require("../src/services/chatIntent.service");
const recommendationService = require("../src/services/recommendation.service");

describe("Structured chat intent", () => {
  test.each([
    ["find a NGO", { kind: "recommendation", target: "ngo", category: null, maxDistanceKm: null }],
    ["find any donation", { kind: "recommendation", target: "donation", category: null, maxDistanceKm: null }],
    ["find vegetable donations within 5 km", { kind: "recommendation", target: "donation", category: "vegetable", maxDistanceKm: 5 }],
  ])("extracts %s", (message, expected) => {
    expect(extractIntent(message)).toMatchObject(expected);
  });

  test("inherits target for a short category follow-up", () => {
    expect(extractIntent("chocolate", [{ role: "user", content: "find an NGO" }])).toMatchObject({
      kind: "recommendation",
      target: "ngo",
      category: "chocolate",
    });
  });

  test("does not turn why not into a repeated recommendation", () => {
    expect(extractIntent("why not", [{ role: "user", content: "find donations" }])).toMatchObject({ kind: "general" });
  });

  test("guards role capabilities", () => {
    expect(capabilityMessage("donor", "donor")).toMatch(/can't search for other donors/);
    expect(capabilityMessage("ngo", "donor")).toMatch(/can't search for donor accounts/);
    expect(capabilityMessage("ngo", "ngo")).toMatch(/can't search for other NGOs/);
  });
});

describe("Recommendation category matching", () => {
  test("matches plural and custom prefixes, including Any", () => {
    expect(recommendationService.categoryMatches("Vegetables", "vegetable")).toBe(true);
    expect(recommendationService.categoryMatches("Chocolatia", "choco")).toBe(true);
    expect(recommendationService.acceptsCategory(["Any"], "rice")).toBe(true);
  });
});