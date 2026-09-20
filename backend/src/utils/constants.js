const USER_ROLES = {
  DONOR: "donor",
  NGO: "ngo",
  ADMIN: "admin"
};

const USER_STATUS = {
  ACTIVE: "active",
  DISABLED: "disabled"
};

const DONATION_STATUS = {
  AVAILABLE: "available",
  PENDING: "pending",
  ACCEPTED: "accepted",
  COMPLETED: "completed",
  EXPIRED: "expired"
};

const REQUEST_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  COMPLETED: "completed"
};

const NOTIFICATION_TYPES = {
  REQUEST_RECEIVED: "request_received",
  REQUEST_ACCEPTED: "request_accepted",
  REQUEST_REJECTED: "request_rejected",
  DONATION_COMPLETED: "donation_completed",
  DONATION_EXPIRED: "donation_expired"
};

const ACTIVE_REQUEST_STATUSES = [REQUEST_STATUS.PENDING, REQUEST_STATUS.ACCEPTED];

/**
 * Allowed values for the structured quantityUnit field on Donation.
 * The free-text `quantity` field remains for backward compatibility and display.
 */
const QUANTITY_UNITS = ["servings", "kg", "g", "liters", "loaves", "boxes", "pieces", "other"];

module.exports = {
  USER_ROLES,
  USER_STATUS,
  DONATION_STATUS,
  REQUEST_STATUS,
  NOTIFICATION_TYPES,
  ACTIVE_REQUEST_STATUSES,
  QUANTITY_UNITS
};
