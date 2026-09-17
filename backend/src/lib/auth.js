import jwt from "jsonwebtoken";
import { config } from "./env.js";
import { prisma } from "./prisma.js";

const TOKEN_EXPIRY = "30d";

export function signToken({ role, userId, operatorId, adminUserId }) {
  return jwt.sign({ role, userId, operatorId, adminUserId }, config.jwtSecret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret); // throws on invalid/expired
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

export function requirePatientAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: { code: "unauthorized", message: "Missing bearer token" } });
  try {
    const payload = verifyToken(token);
    if (payload.role !== "patient") throw new Error("wrong role");
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: { code: "unauthorized", message: "Invalid or expired token" } });
  }
}

export function requireOperatorAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: { code: "unauthorized", message: "Missing bearer token" } });
  try {
    const payload = verifyToken(token);
    if (payload.role !== "operator") throw new Error("wrong role");
    req.operatorId = payload.operatorId;
    next();
  } catch {
    res.status(401).json({ error: { code: "unauthorized", message: "Invalid or expired token" } });
  }
}

// Admin auth accepts either:
//  a) an AdminUser's JWT — the day-to-day login (added 2026-09-18), checked
//     against the DB every request so disabling an account takes effect
//     immediately rather than when their token expires; or
//  b) the shared ADMIN_API_TOKEN — break-glass access, and what creates the
//     very first account before any admin user exists.
// Fails closed: an unrecognised credential is rejected, never waved through.
export async function requireAdmin(req, res, next) {
  const token = bearerToken(req);
  const deny = () =>
    res.status(401).json({ error: { code: "unauthorized", message: "Invalid admin credentials" } });
  if (!token) return deny();

  if (config.adminApiToken && token === config.adminApiToken) {
    req.adminUserId = null; // break-glass: no named user behind this request
    return next();
  }

  try {
    const payload = verifyToken(token);
    if (payload.role !== "admin" || !payload.adminUserId) return deny();
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminUserId },
      select: { id: true, disabledAt: true },
    });
    if (!admin || admin.disabledAt) return deny();
    req.adminUserId = admin.id;
    return next();
  } catch {
    return deny();
  }
}
