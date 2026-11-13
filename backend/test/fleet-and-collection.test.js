import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client, guestToken, operatorToken } from "./helpers/client.js";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;
const admin = (req) => req.set("Authorization", `Bearer ${ADMIN_TOKEN}`);

// Fleet & crew management + direct payment to the operator (2026-11-13).
test("fleet management and paying the operator directly", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();
  const otherPatientToken = await guestToken();
  const tokenA = await operatorToken("fixture-a@test.example", FIXTURE_PASSWORD);
  const tokenB = await operatorToken("fixture-b@test.example", FIXTURE_PASSWORD);
  const opA = (req) => req.set("Authorization", `Bearer ${tokenA}`);
  const opB = (req) => req.set("Authorization", `Bearer ${tokenB}`);
  const patient = (req) => req.set("Authorization", `Bearer ${patientToken}`);
  const quoteIds = async () => {
    const quote = await patient(client.post("/api/bookings/quote")).send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    return quote.body.operators.map((o) => o.operatorId);
  };

  let ambulanceId;
  let crewId;

  await t.test("operator adds an ambulance and crew; the fleet summary follows", async () => {
    const amb = await opA(client.post("/api/operator/ambulances")).send({ plate: " wxy  1234 ", type: "ALS", equipment: ["Defibrillator"] });
    assert.equal(amb.status, 201);
    assert.equal(amb.body.plate, "WXY 1234", "plate is normalised");
    ambulanceId = amb.body.id;

    const crew = await opA(client.post("/api/operator/crew")).send({ name: "Aina Paramedic", role: "PARAMEDIC", phone: "012-345 6789" });
    assert.equal(crew.status, 201);
    crewId = crew.body.id;

    const me = await prisma.operator.findUnique({ where: { id: operators.A.id } });
    assert.equal(me.fleetSummary, "1 ALS, 1 BLS", "fixture BLS + the new ALS");

    const dup = await opB(client.post("/api/operator/ambulances")).send({ plate: "WXY 1234", type: "BLS" });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, "plate_taken");

    const badType = await opA(client.post("/api/operator/ambulances")).send({ plate: "ABC 1", type: "HELICOPTER" });
    assert.equal(badType.status, 400);
    const badRole = await opA(client.post("/api/operator/crew")).send({ name: "Someone", role: "PILOT" });
    assert.equal(badRole.status, 400);
  });

  await t.test("an operator cannot touch another operator's fleet", async () => {
    const amb = await opB(client.patch(`/api/operator/ambulances/${ambulanceId}`)).send({ active: false });
    assert.equal(amb.status, 404);
    const crew = await opB(client.patch(`/api/operator/crew/${crewId}`)).send({ name: "Hijacked" });
    assert.equal(crew.status, 404);
    const noAuth = await client.post("/api/operator/ambulances").send({ plate: "ABC 2", type: "BLS" });
    assert.equal(noAuth.status, 401);
  });

  await t.test("deactivated rows leave the picker but stay in the full list", async () => {
    const off = await opA(client.patch(`/api/operator/crew/${crewId}`)).send({ active: false });
    assert.equal(off.status, 200);
    const picker = await opA(client.get("/api/operator/fleet"));
    assert.ok(!picker.body.crew.some((c) => c.id === crewId));
    const all = await opA(client.get("/api/operator/fleet?all=1"));
    assert.equal(all.body.crew.find((c) => c.id === crewId).active, false);
    await opA(client.patch(`/api/operator/crew/${crewId}`)).send({ active: true });
  });

  await t.test("no active ambulance: hidden from patients and cannot go online", async () => {
    const fleet = await opB(client.get("/api/operator/fleet"));
    assert.ok((await quoteIds()).includes(operators.B.id));
    for (const a of fleet.body.ambulances) {
      await opB(client.patch(`/api/operator/ambulances/${a.id}`)).send({ active: false });
    }
    assert.ok(!(await quoteIds()).includes(operators.B.id), "no ambulance → not offered");
    assert.equal((await prisma.operator.findUnique({ where: { id: operators.B.id } })).fleetSummary, null);

    await opB(client.post("/api/operator/availability")).send({ online: false });
    const online = await opB(client.post("/api/operator/availability")).send({ online: true });
    assert.equal(online.status, 409);
    assert.equal(online.body.error.code, "no_fleet");

    // Admin restores it through the admin fleet endpoints.
    const added = await admin(client.post(`/api/admin/operators/${operators.B.id}/ambulances`)).send({ plate: "BBB 22", type: "BLS" });
    assert.equal(added.status, 201);
    const adminFleet = await admin(client.get(`/api/admin/operators/${operators.B.id}/fleet`));
    assert.equal(adminFleet.body.ambulances.length, 2, "admin list includes the deactivated unit");
    const back = await opB(client.post("/api/operator/availability")).send({ online: true });
    assert.equal(back.status, 200);
    assert.ok((await quoteIds()).includes(operators.B.id));

    const missing = await admin(client.post("/api/admin/operators/nope/crew")).send({ name: "No One", role: "DRIVER" });
    assert.equal(missing.status, 404);
  });

  const qr = "data:image/png;base64,iVBORw0KGgo=";

  await t.test("back office sets the operator's pay-to details; the operator sees them read-only", async () => {
    const put = await admin(client.put(`/api/admin/operators/${operators.A.id}/pay-to`)).send({
      accountName: "Fixture Operator A Sdn Bhd",
      bankName: "Maybank",
      accountNumber: "5123 4567 8901",
      qrImage: qr,
    });
    assert.equal(put.status, 200);
    const mine = await opA(client.get("/api/operator/payment-details"));
    assert.equal(mine.body.bankName, "Maybank");
    assert.equal(mine.body.qrImage, qr);
    const theirs = await opB(client.get("/api/operator/payment-details"));
    assert.equal(theirs.body.qrImage, null, "B has none of A's details");

    const bad = await admin(client.put(`/api/admin/operators/${operators.A.id}/pay-to`)).send({ qrImage: "javascript:alert(1)" });
    assert.equal(bad.status, 400);
    const noAdmin = await opA(client.put(`/api/admin/operators/${operators.A.id}/pay-to`)).send({ bankName: "Evil Bank" });
    assert.equal(noAdmin.status, 401);

    // The QR never rides along on operator lists or quotes.
    const list = await admin(client.get("/api/admin/operators"));
    assert.ok(!JSON.stringify(list.body).includes("iVBORw0KGgo"));
    const quote = await patient(client.post("/api/bookings/quote")).send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
    assert.ok(!JSON.stringify(quote.body).includes("iVBORw0KGgo"));
  });

  let bookingId;

  await t.test("the patient sees who to pay only after an operator accepts", async () => {
    const booked = await patient(client.post("/api/bookings")).send({
      operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "cash",
    });
    bookingId = booked.body.id;

    const before = await patient(client.get(`/api/bookings/${bookingId}/pay-to`));
    assert.equal(before.status, 200);
    assert.equal(before.body.payTo, null, "offered but not accepted — no bank details yet");

    const early = await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "cash" });
    assert.equal(early.status, 409, "nothing to collect before accepting");

    const offers = await opA(client.get("/api/operator/requests"));
    const offer = offers.body.find((o) => o.bookingId === bookingId);
    await opA(client.post(`/api/operator/offers/${offer.offerId}/accept`));

    const after = await patient(client.get(`/api/bookings/${bookingId}/pay-to`));
    assert.equal(after.body.operator.name, "Fixture Operator A");
    assert.equal(after.body.payTo.qrImage, qr);
    assert.equal(after.body.payTo.accountNumber, "5123 4567 8901");
    assert.equal(after.body.amount, booked.body.total);
    assert.equal(after.body.collectedVia, null);

    const stranger = await client.get(`/api/bookings/${bookingId}/pay-to`).set("Authorization", `Bearer ${otherPatientToken}`);
    assert.equal(stranger.status, 403);
  });

  await t.test("the crew records the payment; it can be corrected and shows on the timeline", async () => {
    const wrongOp = await opB(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "cash" });
    assert.equal(wrongOp.status, 403);
    const badVia = await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "bitcoin" });
    assert.equal(badVia.status, 400);

    const unpaid = await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "unpaid" });
    assert.equal(unpaid.status, 200);
    assert.equal(unpaid.body.collectedVia, "unpaid");
    let events = await patient(client.get(`/api/bookings/${bookingId}/tracking`));
    assert.ok(!events.body.some((e) => /unpaid/i.test(e.label)), "unpaid is never announced to the patient");

    for (const status of ["enroute", "arrived", "onboard", "completed"]) {
      await opA(client.post(`/api/bookings/${bookingId}/status`)).send({ status });
    }

    // Settled after the trip — still recordable once completed.
    const paid = await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "duitnow" });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.collectedVia, "duitnow");
    assert.ok(paid.body.collectedAt);
    events = await patient(client.get(`/api/bookings/${bookingId}/tracking`));
    assert.ok(events.body.some((e) => /Payment received/.test(e.label)));

    const again = await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "duitnow" });
    assert.equal(again.status, 200, "repeat is a no-op");
    // A correction rewrites the one timeline line instead of adding another.
    await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "cash" });
    events = await patient(client.get(`/api/bookings/${bookingId}/tracking`));
    let receipts = events.body.filter((e) => /Payment received/.test(e.label));
    assert.equal(receipts.length, 1);
    assert.match(receipts[0].label, /cash/);
    // Taking the receipt back removes it from the patient's timeline.
    await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "unpaid" });
    events = await patient(client.get(`/api/bookings/${bookingId}/tracking`));
    assert.equal(events.body.filter((e) => /Payment received/.test(e.label)).length, 0);
    await opA(client.post(`/api/bookings/${bookingId}/collection`)).send({ via: "duitnow" });

    const seen = await patient(client.get(`/api/bookings/${bookingId}/pay-to`));
    assert.equal(seen.body.collectedVia, "duitnow");

    const history = await opA(client.get("/api/operator/bookings"));
    assert.equal(history.body.find((b) => b.id === bookingId).collectedVia, "duitnow");

    // Recording a payment never touches the Lifeline wallet.
    assert.equal((await prisma.operator.findUnique({ where: { id: operators.A.id } })).walletBalance, 500);
  });

  await t.test("a unit or crew member on a live trip cannot be deactivated", async () => {
    const booked = await patient(client.post("/api/bookings")).send({
      operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "cash",
    });
    const offers = await opA(client.get("/api/operator/requests"));
    const offer = offers.body.find((o) => o.bookingId === booked.body.id);
    await opA(client.post(`/api/operator/offers/${offer.offerId}/accept`));
    const assigned = await opA(client.post(`/api/bookings/${booked.body.id}/assign`)).send({ ambulanceId, crewIds: [crewId] });
    assert.equal(assigned.status, 200);

    const amb = await opA(client.patch(`/api/operator/ambulances/${ambulanceId}`)).send({ active: false });
    assert.equal(amb.status, 409);
    assert.equal(amb.body.error.code, "ambulance_in_use");
    const crew = await opA(client.patch(`/api/operator/crew/${crewId}`)).send({ active: false });
    assert.equal(crew.status, 409);
    assert.equal(crew.body.error.code, "crew_in_use");

    await opA(client.post(`/api/bookings/${booked.body.id}/status`)).send({ status: "completed" });
    const after = await opA(client.patch(`/api/operator/ambulances/${ambulanceId}`)).send({ active: false });
    assert.equal(after.status, 200, "free again once the trip is over");
  });

  await prisma.$disconnect();
});
