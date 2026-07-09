// API client — talks to the Lifeline backend's admin endpoints.
// Same req()/ApiError/setUnauthorizedHandler shape as both Expo apps'
// src/api/client.js, adapted for localStorage (synchronous) instead of
// SecureStore (async) — this app reloads on every visit rather than staying
// resident, so no authLoading boot gate is needed here.
const BASE = import.meta.env.VITE_API_BASE_URL || "http://192.168.100.133:4000";
const TOKEN_KEY = "lifeline_admin_token";

let authToken = localStorage.getItem(TOKEN_KEY) || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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

export const getOperators = () => req("/api/admin/operators");
export const createOperator = (data) => req("/api/admin/operators", { method: "POST", body: JSON.stringify(data) });
export const updateOperator = (id, data) => req(`/api/admin/operators/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const approveOperator = (id) => req(`/api/admin/operators/${id}/approve`, { method: "POST" });
export const suspendOperator = (id) => req(`/api/admin/operators/${id}/suspend`, { method: "POST" });
export const getBookings = () => req("/api/admin/bookings");
export const getPlatformFeeSetting = () => req("/api/admin/settings/platform-fee");
export const updatePlatformFeeSetting = (p) => req("/api/admin/settings/platform-fee", { method: "PUT", body: JSON.stringify(p) });
