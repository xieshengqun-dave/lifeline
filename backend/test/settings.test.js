import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION } from "./helpers/testDb.js";
import { client, guestToken } from "./helpers/client.js";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

test("platform fee setting: default flat, admin can switch to percent and back", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();

  async function quoteFeeFor(operatorId) {
    const res = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    return res.body.operators.find((o) => o.operatorId === operatorId).price;
  }

  await t.test("no settings row present -> defaults to flat RM15 (matches PLATFORM_SERVICE_FEE)", async () => {
    const getRes = await client.get("/api/admin/settings/platform-fee").set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    assert.equal(getRes.status, 200);
    assert.deepEqual(getRes.body, { feeType: "flat", feeValue: 15 });

    const price = await quoteFeeFor(operators.A.id);
    assert.equal(price.serviceFee, 15);
    assert.equal(price.total, Math.round((price.subtotal + 15) * 100) / 100);
  });

  await t.test("admin switches to 10% -> quote reflects percentage of subtotal", async () => {
    const putRes = await client
      .put("/api/admin/settings/platform-fee")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ feeType: "percent", feeValue: 10 });
    assert.equal(putRes.status, 200);
    assert.deepEqual(putRes.body, { feeType: "percent", feeValue: 10 });

    const price = await quoteFeeFor(operators.A.id);
    const expectedFee = Math.round(price.subtotal * 0.1 * 100) / 100;
    assert.equal(price.serviceFee, expectedFee);
  });

  await t.test("admin reverts to flat RM20 -> quote reflects the new flat amount", async () => {
    const putRes = await client
      .put("/api/admin/settings/platform-fee")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ feeType: "flat", feeValue: 20 });
    assert.equal(putRes.status, 200);

    const price = await quoteFeeFor(operators.A.id);
    assert.equal(price.serviceFee, 20);
  });

  await t.test("percent > 100 is rejected", async () => {
    const res = await client
      .put("/api/admin/settings/platform-fee")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ feeType: "percent", feeValue: 150 });
    assert.equal(res.status, 400);
  });

  await t.test("no admin token -> 401", async () => {
    const res = await client.get("/api/admin/settings/platform-fee");
    assert.equal(res.status, 401);
  });
});
