import jwt from "jsonwebtoken";
import { config } from "./env.js";

const TOKEN_EXPIRY = "30d";

export function signToken({ role, userId, operatorId }) {
  return jwt.sign({ role, userId, operatorId }, config.jwtSecret, { expiresIn: TOKEN_EXPIRY });
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

// Static shared-secret admin auth — pilot-only, no admin user table yet.
// Fails closed: if ADMIN_API_TOKEN isn't configured, every admin request is
// rejected rather than silently allowed through.
export function requireAdmin(req, res, next) {
  const token = bearerToken(req);
  if (!config.adminApiToken || token !== config.adminApiToken) {
    return res.status(401).json({ error: { code: "unauthorized", message: "Invalid admin token" } });
  }
  next();
}
