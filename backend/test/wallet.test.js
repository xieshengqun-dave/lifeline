import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client, guestToken, operatorToken } from "./helpers/client.js";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

// Operator wallet (Grab agent model, decided 2026-07-31): platform fee
// deducts from the operator's prepaid float on completion; an operator whose
// wallet can't cover a job's fee neither appears in quotes nor receives the
// offer.
test("operator wallet: fee deduction, gating, admin ledger", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();
  const opToken = await operatorToken("fixture-a@test.example", FIXTURE_PASSWORD);

  async function completeTrip() {
    const quote = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    const target = quote.body.operators.find((o) => o.operatorId === operators.A.id);
    const booked = await client
      .post("/api/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "Cash" });
    const offers = await client.get("/api/operator/requests").set("Authorization", `Bearer ${opToken}`);
    const offer = offers.body.find((o) => o.bookingId === booked.body.id);
    await client.post(`/api/operator/offers/${offer.offerId}/accept`).set("Authorization", `Bearer ${opToken}`);
    for (const status of ["enroute", "arrived", "onboard", "completed"]) {
      await client
        .post(`/api/bookings/${booked.body.id}/status`)
        .set("Authorization", `Bearer ${opToken}`)
        .send({ status });
    }
    return { bookingId: booked.body.id, serviceFee: target.price.serviceFee };
  }

  let firstTrip;

  await t.test("completing a trip deducts the service fee with a ledger row", async () => {
    firstTrip = await completeTrip();
    const wallet = await client.get("/api/operator/wallet").set("Authorization", `Bearer ${opToken}`);
    assert.equal(wallet.status, 200);
    assert.equal(wallet.body.balance, 500 - firstTrip.serviceFee);
    const feeRow = wallet.body.transactions.find((x) => x.type === "service_fee");
    assert.ok(feeRow, "service_fee ledger row exists");
    assert.equal(feeRow.amount, -firstTrip.serviceFee);
    assert.equal(feeRow.bookingId, firstTrip.bookingId);
  });

  await t.test("balance below the fee removes the operator from quotes and offers", async () => {
    // Drain A to below one fee via admin withdrawal
    const wallet = await client.get("/api/operator/wallet").set("Authorization", `Bearer ${opToken}`);
    const drain = await client
      .post(`/api/admin/operators/${operators.A.id}/wallet`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ type: "withdrawal", amount: -(wallet.body.balance - 1), note: "test drain to RM1" });
    assert.equal(drain.status, 201);

    const quote = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    assert.ok(
      !quote.body.operators.some((o) => o.operatorId === operators.A.id),
      "drained operator absent from quote"
    );
    // Booking targeting A anyway falls through to the next candidate (B)
    const booked = await client
      .post("/api/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "Cash" });
    assert.equal(booked.body.operatorId, operators.B.id, "offer cascaded to the next affordable operator");
    await client.post(`/api/bookings/${booked.body.id}/cancel`).set("Authorization", `Bearer ${patientToken}`);
  });

  await t.test("admin top-up restores eligibility and the ledger is consistent", async () => {
    const topup = await client
      .post(`/api/admin/operators/${operators.A.id}/wallet`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ type: "topup", amount: 200, note: "test refill ref-123" });
    assert.equal(topup.status, 201);
    assert.equal(topup.body.balanceAfter, 201);

    const quote = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    assert.ok(quote.body.operators.some((o) => o.operatorId === operators.A.id), "refilled operator back in quote");

    // Ledger sum equals balance (derivability invariant)
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
