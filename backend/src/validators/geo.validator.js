/**
 * Reusable GeoJSON Point validation and parsing utilities.
 */

function parseGeoLocation(value) {
  if (value === undefined || value === null || value === "" || value === "null") {
    return undefined;
  }
  if (typeof value === "object") {
    if (!value || !value.type || !value.coordinates) return undefined;
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || parsed === null || !parsed.type || !parsed.coordinates) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function validateGeoLocation(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  let geo = value;
  if (typeof geo === "string") {
    try {
      geo = JSON.parse(geo);
    } catch {
      throw new Error("geoLocation must be a valid JSON object");
    }
  }
  if (typeof geo !== "object" || geo === null || Array.isArray(geo)) {
    throw new Error("geoLocation must be an object with { type: 'Point', coordinates: [longitude, latitude] }");
  }
  if (geo.type !== "Point") {
    throw new Error("geoLocation type must be 'Point'");
  }
  if (!Array.isArray(geo.coordinates) || geo.coordinates.length !== 2) {
    throw new Error("geoLocation coordinates must be an array of exactly 2 numbers [longitude, latitude]");
  }
  const [lng, lat] = geo.coordinates;
  if (typeof lng !== "number" || !Number.isFinite(lng) || typeof lat !== "number" || !Number.isFinite(lat)) {
    throw new Error("geoLocation coordinates must contain valid numbers");
  }
  if (lng < -180 || lng > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }
  if (lat < -90 || lat > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  return true;
}

module.exports = {
  validateGeoLocation,
  parseGeoLocation
};
