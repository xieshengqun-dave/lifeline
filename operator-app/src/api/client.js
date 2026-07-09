// API client — talks to the Lifeline backend's operator-scoped endpoints.
// Same req()/ApiError/authToken pattern as the patient app's src/api/client.js.
import Constants from "expo-constants";

const BASE = Constants.expoConfig?.extra?.apiBaseUrl || "http://localhost:4000";

let authToken = null;
export function setAuthToken(t) {
  authToken = t;
}
export function getAuthToken() {
  return authToken;
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {}

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    const e = body?.error || {};
    throw new ApiError(res.status, e.code || "unknown_error", e.message || `API ${res.status}`);
  }
  return body;
}

// ── Auth ──
export const operatorLogin = (email, password) =>
  req("/api/auth/operator/login", { method: "POST", body: JSON.stringify({ email, password }) });

// ── Operator ──
export const getOperatorMe = () => req("/api/operator/me");
export const getOperatorFleet = () => req("/api/operator/fleet");
export const getOperatorRequests = () => req("/api/operator/requests");
export const acceptOffer = (offerId) => req(`/api/operator/offers/${offerId}/accept`, { method: "POST" });
export const declineOffer = (offerId) => req(`/api/operator/offers/${offerId}/decline`, { method: "POST" });
export const setAvailability = (online) =>
  req("/api/operator/availability", { method: "POST", body: JSON.stringify({ online }) });
export const getOperatorBookings = () => req("/api/operator/bookings");
export const getOperatorBooking = (id) => req(`/api/operator/bookings/${id}`);

// ── Bookings (operator-authed) ──
export const assignBookingResources = (id, p) => req(`/api/bookings/${id}/assign`, { method: "POST", body: JSON.stringify(p) });
export const advanceBookingStatus = (id, status) =>
  req(`/api/bookings/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
