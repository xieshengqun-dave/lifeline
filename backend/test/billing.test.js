import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client, guestToken, operatorToken } from "./helpers/client.js";
import { currentMonth, runSubscriptionCycle, billingStatus, billingDates } from "../src/services/billing.js";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;
const admin = (req) => req.set("Authorization", `Bearer ${ADMIN_TOKEN}`);

// SaaS subscription billing (decided 2026-11-04): each approved operator is
// charged a monthly subscription on the 1st (MYT), due on the due day, and
// paused (hidden from patients) when still unpaid after the grace days. A
// recorded payment lifts an automatic pause; admins can pause/resume by hand.
// The cycle is driven with explicit dates (Nov 2026, MYT) so the test does
// not depend on today's date.
const at = (iso) => new Date(iso);
const NOV_3 = at("2026-11-03T02:00:00Z");
const NOV_10 = at("2026-11-10T02:00:00Z"); // after the due date (7th), inside grace
const NOV_16 = at("2026-11-16T02:00:00Z"); // after due (7th) + 7 grace days

test("SaaS subscription: monthly charge, overdue pause, payment release, manual pause", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();
  const opToken = await operatorToken("fixture-a@test.example", FIXTURE_PASSWORD);
  const op = (req) => req.set("Authorization", `Bearer ${opToken}`);
  const balanceOf = async (id) => (await prisma.operator.findUnique({ where: { id } })).walletBalance;
  const quoteIds = async () => {
    const quote = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    return quote.body.operators.map((o) => o.operatorId);
  };

  // A owes from the start (no float), B gets a custom price, C was approved
  // this month (first charge is next month).
  await prisma.operator.update({ where: { id: operators.A.id }, data: { walletBalance: 0 } });
  await prisma.operator.update({ where: { id: operators.C.id }, data: { approvedAt: at("2026-11-02T04:00:00Z") } });

  await t.test("nothing is charged while the subscription price is RM0", async () => {
    const result = await runSubscriptionCycle(NOV_3);
    assert.equal(result.charged, 0);
  });

  await t.test("admin sets the price and a custom price for one operator", async () => {
    const set = await admin(client.put("/api/admin/settings/subscription")).send({ price: 300, dueDay: 7, graceDays: 7 });
    assert.equal(set.status, 200);
    const custom = await admin(client.post(`/api/admin/operators/${operators.B.id}/billing`)).send({ subscriptionPrice: 150 });
    assert.equal(custom.status, 200);
    assert.equal(custom.body.subscriptionPrice, 150);
  });

  await t.test("the 1st-of-month cycle charges each operator once", async () => {
    const first = await runSubscriptionCycle(NOV_3);
    assert.equal(first.month, "2026-11");
    assert.equal(await balanceOf(operators.A.id), -300);
    assert.equal(await balanceOf(operators.B.id), 350, "custom RM150 price");
    assert.equal(await balanceOf(operators.C.id), 500, "approved this month — not charged yet");
    const again = await runSubscriptionCycle(NOV_10);
    assert.equal(again.charged, 0, "same month is never charged twice");
    assert.equal(again.paused, 0, "still inside the grace period");
  });

  await t.test("status moves from due to overdue at the due date", async () => {
    const settings = { price: 300, dueDay: 7, graceDays: 7 };
    const opA = await prisma.operator.findUnique({ where: { id: operators.A.id } });
    assert.equal(billingStatus(opA, settings, NOV_3), "due");
    assert.equal(billingStatus(opA, settings, NOV_10), "overdue");
    const opB = await prisma.operator.findUnique({ where: { id: operators.B.id } });
    assert.equal(billingStatus(opB, settings, NOV_10), "paid", "B's float covered it");
    const { dueAt, pauseAt } = billingDates("2026-11", settings);
    assert.equal(dueAt.toISOString(), "2026-11-07T16:00:00.000Z", "end of 7 Nov MYT");
    assert.equal(pauseAt.toISOString(), "2026-11-14T16:00:00.000Z");
  });

  await t.test("still unpaid after the grace period: paused and hidden from patients", async () => {
    assert.ok((await quoteIds()).includes(operators.A.id));
    const result = await runSubscriptionCycle(NOV_16);
    assert.equal(result.paused, 1);
    assert.ok(!(await quoteIds()).includes(operators.A.id), "paused operator absent from quotes");

    const online = await op(client.post("/api/operator/availability")).send({ online: true });
    assert.equal(online.status, 409);
    assert.equal(online.body.error.code, "billing_hold");

    const wallet = await op(client.get("/api/operator/wallet"));
    assert.equal(wallet.body.amountOwed, 300);
    assert.equal(wallet.body.billing.status, "paused");
    assert.equal(wallet.body.billing.billingHoldReason, "overdue");
    assert.equal(wallet.body.billing.price, 300);
  });

  await t.test("recording the payment lifts the pause", async () => {
    const paid = await admin(client.post(`/api/admin/operators/${operators.A.id}/wallet`)).send({
      type: "topup",
      amount: 300,
      note: "Nov subscription — bank transfer ref TEST123",
    });
    assert.equal(paid.status, 201);
    const me = await op(client.get("/api/operator/me"));
    assert.equal(me.body.billingHold, false);
    const online = await op(client.post("/api/operator/availability")).send({ online: true });
    assert.equal(online.status, 200);
    assert.ok((await quoteIds()).includes(operators.A.id));
  });

  await t.test("a manual pause stays until the admin resumes it", async () => {
    const pause = await admin(client.post(`/api/admin/operators/${operators.B.id}/billing`)).send({ billingHold: true });
    assert.equal(pause.status, 200);
    assert.equal(pause.body.billingHold, true);
    assert.equal(pause.body.billingHoldReason, "manual");
    assert.ok(!(await quoteIds()).includes(operators.B.id));

    await admin(client.post(`/api/admin/operators/${operators.B.id}/wallet`)).send({ type: "topup", amount: 10, note: "unrelated payment" });
    await runSubscriptionCycle(NOV_16);
    assert.equal((await prisma.operator.findUnique({ where: { id: operators.B.id } })).billingHold, true);

    const resume = await admin(client.post(`/api/admin/operators/${operators.B.id}/billing`)).send({ billingHold: false });
    assert.equal(resume.body.billingHold, false);
  });

  await t.test("statement and billing summary show the subscription", async () => {
    const month = currentMonth(); // ledger rows carry the real clock
    const statement = await op(client.get(`/api/operator/statement?month=${month}`));
    assert.equal(statement.status, 200);
    assert.equal(statement.body.subscription, 300);
    assert.equal(statement.body.payments, 300);
    assert.equal(statement.body.closingBalance, 0);

    const summary = await admin(client.get(`/api/admin/billing?month=${month}`));
    const rowB = summary.body.operators.find((r) => r.operatorId === operators.B.id);
    assert.equal(rowB.price, 150);
    assert.equal(rowB.customPrice, 150);
    const rowC = summary.body.operators.find((r) => r.operatorId === operators.C.id);
    assert.equal(rowC.subscription, 0);

    const bad = await admin(client.get("/api/admin/billing?month=2026-13"));
    assert.equal(bad.status, 400);
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
