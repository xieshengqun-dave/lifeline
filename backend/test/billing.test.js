import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client, guestToken, operatorToken } from "./helpers/client.js";
import { currentMonth, monthRange } from "../src/services/billing.js";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;
const admin = (req) => req.set("Authorization", `Bearer ${ADMIN_TOKEN}`);

// Monthly billing (decided 2026-10-20): patients pay operators directly,
// fees accrue as a negative wallet balance up to an admin-set credit limit,
// and the admin bills each operator monthly from a ledger-derived statement.
test("monthly billing: credit limit, statements, payments, pay-to details", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  await prisma.operator.update({ where: { id: operators.A.id }, data: { walletBalance: 0 } });
  const patientToken = await guestToken();
  const opToken = await operatorToken("fixture-a@test.example", FIXTURE_PASSWORD);
  const op = (req) => req.set("Authorization", `Bearer ${opToken}`);

  const quoteHasA = async () => {
    const quote = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    return quote.body.operators.some((o) => o.operatorId === operators.A.id);
  };

  async function completeTripWithA() {
    const booked = await client
      .post("/api/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "cash" });
    assert.equal(booked.body.operatorId, operators.A.id, "offer went to A");
    const offers = await op(client.get("/api/operator/requests"));
    const offer = offers.body.find((o) => o.bookingId === booked.body.id);
    await op(client.post(`/api/operator/offers/${offer.offerId}/accept`));
    for (const status of ["enroute", "arrived", "onboard", "completed"]) {
      await op(client.post(`/api/bookings/${booked.body.id}/status`)).send({ status });
    }
    return booked.body;
  }

  await t.test("credit limit 0 (default) keeps the prepaid rule", async () => {
    const res = await admin(client.get("/api/admin/settings/credit-limit"));
    assert.deepEqual(res.body, { amount: 0 });
    assert.equal(await quoteHasA(), false, "RM0 balance can't cover a fee without credit");
    const online = await op(client.post("/api/operator/availability")).send({ online: true });
    assert.equal(online.status, 409);
  });

  await t.test("with a credit limit the operator works on credit and owes the fees", async () => {
    const set = await admin(client.put("/api/admin/settings/credit-limit")).send({ amount: 100 });
    assert.deepEqual(set.body, { amount: 100 });
    assert.equal(await quoteHasA(), true, "credit covers the fee");
    const online = await op(client.post("/api/operator/availability")).send({ online: true });
    assert.equal(online.status, 200);

    await completeTripWithA();
    await completeTripWithA();
    const wallet = await op(client.get("/api/operator/wallet"));
    assert.equal(wallet.body.balance, -30, "two flat RM15 fees");
    assert.equal(wallet.body.amountOwed, 30);
    assert.equal(wallet.body.creditLimit, 100);
    assert.equal(wallet.body.availableCredit, 70);
  });

  await t.test("reaching the limit removes the operator from quotes and blocks going online", async () => {
    await admin(client.put("/api/admin/settings/credit-limit")).send({ amount: 40 });
    assert.equal(await quoteHasA(), false, "RM10 headroom can't cover a RM15 fee");
    await op(client.post("/api/operator/availability")).send({ online: false });
    const online = await op(client.post("/api/operator/availability")).send({ online: true });
    assert.equal(online.status, 409, "RM10 available is below the RM50 minimum");
    assert.match(online.body.error?.message ?? online.text, /credit limit/);
  });

  await t.test("statement and billing summary match the ledger", async () => {
    const month = currentMonth();
    const statement = await op(client.get(`/api/operator/statement?month=${month}`));
    assert.equal(statement.status, 200);
    assert.equal(statement.body.openingBalance, 0);
    assert.equal(statement.body.closingBalance, -30);
    assert.equal(statement.body.amountDue, 30);
    assert.equal(statement.body.trips, 2);
    assert.equal(statement.body.fees, 30);
    assert.equal(statement.body.transactions.length, 2);
    assert.ok(statement.body.transactions[0].booking?.pickupName, "lines carry trip details");

    const summary = await admin(client.get(`/api/admin/billing?month=${month}`));
    const rowA = summary.body.operators.find((r) => r.operatorId === operators.A.id);
    assert.equal(rowA.amountDue, 30);
    const rowB = summary.body.operators.find((r) => r.operatorId === operators.B.id);
    assert.equal(rowB.amountDue, 0, "untouched operator owes nothing");
    assert.equal(rowB.closingBalance, 500);

    const bad = await admin(client.get("/api/admin/billing?month=2026-13"));
    assert.equal(bad.status, 400);
  });

  await t.test("recording the operator's bank transfer clears what they owe", async () => {
    const paid = await admin(client.post(`/api/admin/operators/${operators.A.id}/wallet`)).send({
      type: "topup",
      amount: 30,
      note: "October bill — bank transfer ref TEST123",
    });
    assert.equal(paid.status, 201);
    const wallet = await op(client.get("/api/operator/wallet"));
    assert.equal(wallet.body.amountOwed, 0);
    const statement = await admin(client.get(`/api/admin/operators/${operators.A.id}/statement`));
    assert.equal(statement.body.payments, 30);
    assert.equal(statement.body.amountDue, 0);
  });

  await t.test("past month statement only counts that month", async () => {
    const { start } = monthRange(currentMonth());
    const lastMonth = new Date(start.getTime() - 24 * 3600 * 1000);
    const month = new Date(lastMonth.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 7);
    const statement = await admin(client.get(`/api/admin/operators/${operators.A.id}/statement?month=${month}`));
    assert.equal(statement.body.trips, 0);
    assert.equal(statement.body.closingBalance, 0, "closing of last month = opening of this month");
  });

  await t.test("admin sets company pay-to details; operators can read them", async () => {
    const qr = "data:image/png;base64,iVBORw0KGgo=";
    const put = await admin(client.put("/api/admin/settings/pay-to")).send({
      accountName: "Lifeline Sdn Bhd",
      bankName: "Maybank",
      accountNumber: "5123 4567 8901",
      instructions: "Use your operator name as the reference",
      qrImage: qr,
    });
    assert.equal(put.status, 200);
    const read = await op(client.get("/api/operator/pay-to"));
    assert.equal(read.body.bankName, "Maybank");
    assert.equal(read.body.qrImage, qr);

    const notImage = await admin(client.put("/api/admin/settings/pay-to")).send({ qrImage: "javascript:alert(1)" });
    assert.equal(notImage.status, 400);

    const cleared = await admin(client.put("/api/admin/settings/pay-to")).send({ bankName: "  " });
    assert.equal(cleared.body.bankName, null, "blank clears");
    assert.equal(cleared.body.qrImage, null, "omitted clears");

    const noAuth = await client.get("/api/operator/pay-to");
    assert.equal(noAuth.status, 401);
  });

  await prisma.$disconnect();
});
