import request from "supertest";
import app from "../../src/app.js";

export const client = request(app);

export async function guestToken() {
  const res = await client.post("/api/auth/guest");
  return res.body.token;
}

export async function operatorToken(email, password) {
  const res = await client.post("/api/auth/operator/login").send({ email, password });
  return res.body.token;
}
