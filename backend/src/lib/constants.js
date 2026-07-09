// Single source of truth for every status/type string used across the app.
// Booking.status is LOCKED per CLAUDE.md — do not add/remove values here
// without updating CLAUDE.md's state machine list in the same change.

export const BOOKING_STATUS = Object.freeze({
  REQUESTED: "requested",
  OFFERED: "offered",
  ACCEPTED: "accepted",
  ENROUTE: "enroute",
  ARRIVED: "arrived",
  ONBOARD: "onboard",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DECLINED: "declined",
  EXPIRED: "expired",
});

// Order matters: used to validate forward-only status advancement.
export const BOOKING_STATUS_PROGRESSION = [
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.ENROUTE,
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.ONBOARD,
  BOOKING_STATUS.COMPLETED,
];

export const OFFER_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  TIMED_OUT: "timed_out",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
});

export const VETTING_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended",
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
});

export const AMBULANCE_TYPE = Object.freeze({
  ALS: "ALS",
  BLS: "BLS",
  NEONATAL: "NEONATAL",
});

export const CREW_ROLE = Object.freeze({
  DRIVER: "DRIVER",
  PARAMEDIC: "PARAMEDIC",
});

export const AUTH_PROVIDER = Object.freeze({
  GUEST: "guest",
  GOOGLE: "google",
  APPLE: "apple",
});

export const PLATFORM_FEE_TYPE = Object.freeze({
  FLAT: "flat",
  PERCENT: "percent",
});
