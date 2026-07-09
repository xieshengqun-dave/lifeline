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

// Joins booking:{id}'s room and wires handlers; re-joins on every reconnect
// (Socket.IO rooms don't survive a disconnect — dropped Wi-Fi mid-wait is a
// realistic case for this app). Returns an unsubscribe function.
export function subscribeToBooking(bookingId, { onOffer, onStatusChanged, onTrackingEvent } = {}) {
  const s = getSocket();
  const join = () => s.emit("join_booking", { bookingId }, () => {});
  join();
  s.on("connect", join);
  if (onOffer) s.on("booking:offer_operator", onOffer);
  if (onStatusChanged) s.on("booking:status_changed", onStatusChanged);
  if (onTrackingEvent) s.on("tracking:event", onTrackingEvent);

  return () => {
    s.emit("leave_booking", { bookingId });
    s.off("connect", join);
    if (onOffer) s.off("booking:offer_operator", onOffer);
    if (onStatusChanged) s.off("booking:status_changed", onStatusChanged);
    if (onTrackingEvent) s.off("tracking:event", onTrackingEvent);
  };
}
