import { io } from "socket.io-client";
import Constants from "expo-constants";
import { getAuthToken } from "./client";

const BASE = Constants.expoConfig?.extra?.apiBaseUrl || "http://localhost:4000";
let socket = null;

function getSocket() {
  if (!socket) socket = io(BASE, { transports: ["websocket"], auth: { token: getAuthToken() } });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// Operators auto-join their own room (operator:{operatorId}) server-side on
// connect — no join emit needed, unlike booking rooms. onConnect fires on
// every (re)connect, used to trigger a resync fetch in case events were
// missed during a disconnect window.
export function subscribeToOperatorEvents({ onOfferCreated, onConnect } = {}) {
  const s = getSocket();
  if (onOfferCreated) s.on("offer:created", onOfferCreated);
  if (onConnect) s.on("connect", onConnect);
  return () => {
    if (onOfferCreated) s.off("offer:created", onOfferCreated);
    if (onConnect) s.off("connect", onConnect);
  };
}

// Used by ActiveTripScreen — joins booking:{id}'s room (already authorizes
// the assigned operator server-side, confirmed in the backend's socket.js).
export function subscribeToBooking(bookingId, { onStatusChanged } = {}) {
  const s = getSocket();
  const join = () => s.emit("join_booking", { bookingId }, () => {});
  join();
  s.on("connect", join);
  if (onStatusChanged) s.on("booking:status_changed", onStatusChanged);

  return () => {
    s.emit("leave_booking", { bookingId });
    s.off("connect", join);
    if (onStatusChanged) s.off("booking:status_changed", onStatusChanged);
  };
}
