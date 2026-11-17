const recommendationService = require("../src/services/recommendation.service");
const { CLASSIFY_CHAT_INTENT_TOOL } = require("../src/services/groq.service");

describe("Model-led FreshTrack intent classification", () => {
  test("normalizes categories for database matching", () => {
    expect(recommendationService.normalizeCategory("Vegetables")).toBe("vegetable");
    expect(recommendationService.normalizeCategory("Cooked Food")).toBe("cooked food");
  });

  test("uses only search, general, and unsupported routes", () => {
    expect(CLASSIFY_CHAT_INTENT_TOOL.function.parameters.properties.action.enum).toEqual([
      "search",
      "general",
      "unsupported"
    ]);
    expect(CLASSIFY_CHAT_INTENT_TOOL.function.parameters.required).toEqual([
      "action",
      "target",
      "category",
      "maxDistanceKm",
      "sortByDistance",
      "distanceSortOrder",
      "reply"
    ]);
  });
});

describe("Recommendation category matching", () => {
  test("matches plural and custom prefixes, including Any", () => {
    expect(recommendationService.categoryMatches("Vegetables", "vegetable")).toBe(true);
    expect(recommendationService.categoryMatches("Chocolatia", "choco")).toBe(true);
    expect(recommendationService.acceptsCategory(["Any"], "rice")).toBe(true);
  });
});
