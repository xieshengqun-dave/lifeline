import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client, guestToken, operatorToken } from "./helpers/client.js";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

// Operator wallet ledger. Since the SaaS model (2026-11-04) trips no longer
// move money in the wallet (patients pay operators directly, no per-trip
// fee); the ledger carries subscriptions (see billing.test.js) and
// admin-recorded payments/adjustments.
test("operator wallet: trips are fee-free, admin ledger", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();
  const opToken = await operatorToken("fixture-a@test.example", FIXTURE_PASSWORD);

  await t.test("completing a trip leaves the wallet untouched", async () => {
    const booked = await client
      .post("/api/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "cash" });
    const offers = await client.get("/api/operator/requests").set("Authorization", `Bearer ${opToken}`);
    const offer = offers.body.find((o) => o.bookingId === booked.body.id);
    await client.post(`/api/operator/offers/${offer.offerId}/accept`).set("Authorization", `Bearer ${opToken}`);
    for (const status of ["enroute", "arrived", "onboard", "completed"]) {
      await client
        .post(`/api/bookings/${booked.body.id}/status`)
        .set("Authorization", `Bearer ${opToken}`)
        .send({ status });
    }
    const wallet = await client.get("/api/operator/wallet").set("Authorization", `Bearer ${opToken}`);
    assert.equal(wallet.status, 200);
    assert.equal(wallet.body.balance, 500);
    assert.equal(wallet.body.transactions.length, 0);
  });

  await t.test("a low or negative balance no longer hides an operator", async () => {
    await prisma.operator.update({ where: { id: operators.A.id }, data: { walletBalance: -50 } });
    const quote = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    assert.ok(quote.body.operators.some((o) => o.operatorId === operators.A.id));
    await prisma.operator.update({ where: { id: operators.A.id }, data: { walletBalance: 500 } });
  });

  await t.test("admin movements post ledger rows and the ledger stays consistent", async () => {
    const topup = await client
      .post(`/api/admin/operators/${operators.A.id}/wallet`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ type: "topup", amount: 200, note: "test payment ref-123" });
    assert.equal(topup.status, 201);
    assert.equal(topup.body.balanceAfter, 700);
    const adj = await client
      .post(`/api/admin/operators/${operators.A.id}/wallet`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ type: "adjustment", amount: -25.5, note: "correction" });
    assert.equal(adj.status, 201);

    const ledger = await client
      .get(`/api/admin/operators/${operators.A.id}/wallet`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    const sum = ledger.body.transactions.reduce((s, x) => s + x.amount, 0);
    const seedBalance = 500; // fixture starting float has no ledger row
    assert.equal(Math.round((seedBalance + sum) * 100) / 100, ledger.body.walletBalance);
  });

  await t.test("invalid amounts are rejected", async () => {
    const zero = await client
      .post(`/api/admin/operators/${operators.A.id}/wallet`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ type: "topup", amount: 0, note: "zero" });
    assert.equal(zero.status, 400);
    const negativeTopup = await client
      .post(`/api/admin/operators/${operators.A.id}/wallet`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ type: "topup", amount: -50, note: "negative topup" });
    assert.equal(negativeTopup.status, 400);
  });

  await prisma.$disconnect();
});
