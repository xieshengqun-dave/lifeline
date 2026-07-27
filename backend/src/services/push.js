import { prisma } from "../lib/prisma.js";

// Remote push via Expo's push service (https://docs.expo.dev/push-notifications/).
// The HTTP API itself needs no server credential — delivery credentials live
// on Expo's side per app: Android needs an FCM V1 service account uploaded via
// `eas credentials`, iOS needs APNs (Apple Developer account). Both are
// flagged human steps — until they're done, sends are accepted by this API
// but not delivered, and Expo Go (SDK 53+) can't receive remote pushes at
// all; a dev/preview build is required. See HANDOFF.md.
//
// Every send here is fire-and-forget: a push must never break the booking
// path (CLAUDE.md: never silently swallow errors on the booking path — so we
// log failures loudly, but we don't throw).

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoToken(t) {
  return typeof t === "string" && /^(ExponentPushToken|ExpoPushToken)\[/.test(t);
}

async function send(token, { title, body, data }) {
  if (!isExpoToken(token)) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ to: token, title, body, data, sound: "default", priority: "high" }]),
    });
    const out = await res.json().catch(() => null);
    const ticket = out?.data?.[0];
    if (!res.ok || ticket?.status === "error") {
      console.error(`push send failed (${ticket?.details?.error || res.status}):`, title);
    }
  } catch (err) {
    console.error("push send failed:", err.message);
  }
}

export async function pushToUser(userId, message) {
  if (!userId) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
  if (user?.pushToken) await send(user.pushToken, message);
}

export async function pushToOperator(operatorId, message) {
  if (!operatorId) return;
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { pushToken: true },
  });
  if (operator?.pushToken) await send(operator.pushToken, message);
}
