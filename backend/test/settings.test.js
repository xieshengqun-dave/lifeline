import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION } from "./helpers/testDb.js";
import { client, guestToken } from "./helpers/client.js";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;
const admin = (req) => req.set("Authorization", `Bearer ${ADMIN_TOKEN}`);

// SaaS model (2026-11-04): patients pay only the operator's own price — no
// platform/service fee — and the BO sets the operator subscription instead.
test("pricing has no service fee; subscription settings are admin-controlled", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();

  await t.test("quote total equals the operator's own price", async () => {
    const res = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    const price = res.body.operators.find((o) => o.operatorId === operators.A.id).price;
    assert.equal(price.serviceFee, 0);
    assert.equal(price.total, price.subtotal);
  });

  await t.test("subscription defaults: RM0 (not charging), due on the 7th, 7 days' grace", async () => {
    const res = await admin(client.get("/api/admin/settings/subscription"));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { price: 0, dueDay: 7, graceDays: 7 });
  });

  await t.test("admin sets the subscription", async () => {
    const res = await admin(client.put("/api/admin/settings/subscription")).send({ price: 299, dueDay: 10, graceDays: 5 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { price: 299, dueDay: 10, graceDays: 5 });
  });

  await t.test("a due day past the 28th is rejected", async () => {
    const res = await admin(client.put("/api/admin/settings/subscription")).send({ price: 299, dueDay: 31, graceDays: 5 });
    assert.equal(res.status, 400);
  });

  await t.test("the old per-trip fee endpoints are gone", async () => {
    const res = await admin(client.get("/api/admin/settings/platform-fee"));
    assert.equal(res.status, 404);
  });

  await t.test("no admin token -> 401", async () => {
    const res = await client.get("/api/admin/settings/subscription");
    assert.equal(res.status, 401);
  });
});
