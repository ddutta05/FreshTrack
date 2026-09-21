const { USER_ROLES } = require("../utils/constants");

const RECOMMENDATION_WORDS = /\b(find|show|search|nearby|available|looking for|look for)\b/i;
const FAQ_WORDS = /\b(how do i|how can i|what is|why can't|why can\x27t|how does|explain)\b/i;
const TARGET_WORDS = {
  ngo: /\bngos?\b/i,
  donation: /\b(donations?|food)\b/i,
  donor: /\bdonors?\b/i,
};
const RADIUS_PATTERN = /\b(?:within|under|below|less than|up to)\s+(\d+(?:\.\d+)?)\s*(?:km|kilometers?)\b/i;
const STOP_WORDS = new Set([
  "a", "an", "any", "the", "for", "me", "near", "nearby", "available", "food", "donation", "donations",
  "ngo", "ngos", "donor", "donors", "find", "show", "search", "please", "that", "which", "one", "are", "closest",
  "within", "under", "below", "less", "than", "up", "to", "in", "km", "kilometer", "kilometers"
]);

function normalizeCategory(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

function categoryFromText(text) {
  const source = String(text || "");
  const categoryPhrase = source.match(/\b(?:for|accepts?|category)\s+([a-z][a-z\s-]{1,40})/i)?.[1] || source;
  const words = categoryPhrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word) && !/^\d+(?:\.\d+)?$/.test(word));
  const candidate = words.slice(-2).join(" ");
  return candidate && !["which", "which are", "near me", "nearby"].includes(candidate) ? candidate : null;
}

function targetFromText(text) {
  if (TARGET_WORDS.ngo.test(text)) return "ngo";
  if (TARGET_WORDS.donor.test(text)) return "donor";
  if (TARGET_WORDS.donation.test(text)) return "donation";
  return "none";
}

function inferTarget(history) {
  for (const item of [...history].reverse()) {
    if (item.role !== "user") continue;
    const target = targetFromText(item.content);
    if (target !== "none") return target;
  }
  return "none";
}

function extractIntent(message, history = []) {
  const text = String(message || "").trim();
  const recent = Array.isArray(history) ? history.slice(-6) : [];
  const target = targetFromText(text);
  const inheritedTarget = target === "none" ? inferTarget(recent) : target;
  const radius = text.match(RADIUS_PATTERN);
  const category = target === "none" && inheritedTarget !== "none"
    ? categoryFromText(text)
    : categoryFromText(text);

  if (/^why\s+(not|no)\b/i.test(text)) {
    return { kind: "general", target: "none", category: null, maxDistanceKm: null };
  }

  if (FAQ_WORDS.test(text) && !RECOMMENDATION_WORDS.test(text)) {
    return { kind: "faq", target: "none", category: null, maxDistanceKm: null };
  }

  if (target === "donor" || (target === "ngo" && inheritedTarget === "ngo" && /\b(find|show|search|nearby)\b/i.test(text) === false)) {
    return { kind: "unsupported", target, category: null, maxDistanceKm: null };
  }

  const recommendation = RECOMMENDATION_WORDS.test(text) || target !== "none" || (inheritedTarget !== "none" && !!category);
  if (!recommendation) return { kind: "general", target: "none", category: null, maxDistanceKm: null };

  return {
    kind: "recommendation",
    target: inheritedTarget,
    category: category || null,
    maxDistanceKm: radius ? Number(radius[1]) : null,
  };
}

function capabilityMessage(role, target) {
  if (role === USER_ROLES.DONOR && target === "donor") {
    return "I'm logged in with your donor account, so I can help you find NGOs for your donations, but I can't search for other donors.";
  }
  if (role === USER_ROLES.NGO && target === "donor") {
    return "I'm logged in with your NGO account, so I can help you find available food donations. I can't search for donor accounts.";
  }
  if (role === USER_ROLES.NGO && target === "ngo") {
    return "I can help you find available food donations, but I can't search for other NGOs from an NGO account.";
  }
  return null;
}

module.exports = { extractIntent, capabilityMessage, normalizeCategory };