// API client — talks to the Lifeline backend.
// In Expo, set the base URL in app.json (extra.apiBaseUrl) or via env.
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
export const authGuest = () => req("/api/auth/guest", { method: "POST" });

// Not called from any screen yet — needs real GOOGLE_CLIENT_ID/APPLE_CLIENT_ID
// from real developer accounts first. Kept so a future dev wiring real keys
// has the plumbing ready. See LoginScreen for why the UI doesn't call these.
export const authGoogle = (p) => req("/api/auth/google", { method: "POST", body: JSON.stringify(p) });
export const authApple = (p) => req("/api/auth/apple", { method: "POST", body: JSON.stringify(p) });

// ── Bookings ──
export const getBookingQuote = (p) => req("/api/bookings/quote", { method: "POST", body: JSON.stringify(p) });
export const createBooking = (p) => req("/api/bookings", { method: "POST", body: JSON.stringify(p) });
export const skipBooking = (id) => req(`/api/bookings/${id}/skip`, { method: "POST" });
export const cancelBooking = (id) => req(`/api/bookings/${id}/cancel`, { method: "POST" });
export const getBooking = (id) => req(`/api/bookings/${id}`);
export const getTracking = (id) => req(`/api/bookings/${id}/tracking`);
export const submitRating = (id, p) => req(`/api/bookings/${id}/rating`, { method: "POST", body: JSON.stringify(p) });
