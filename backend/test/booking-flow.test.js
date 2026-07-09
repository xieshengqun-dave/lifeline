import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client, guestToken, operatorToken } from "./helpers/client.js";
import { expireOffer } from "../src/services/offerEngine.js";
import { prisma } from "../src/lib/prisma.js";
import { haversineKm } from "../src/lib/geo.js";

// The BUILD-PLAN "done when" critical path: quote -> book -> offer -> decline
// -> re-offer -> timeout -> re-offer -> accept -> status updates -> complete.
test("booking critical path", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();

  let bookingId, offerAId;

  await t.test("quote ranks by distance and excludes the out-of-radius operator", async () => {
    const res = await client
      .post("/api/bookings/quote")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });

    assert.equal(res.status, 200);
    const ids = res.body.operators.map((o) => o.operatorId);
    assert.deepEqual(ids, [operators.A.id, operators.B.id, operators.C.id]);

    const distances = res.body.operators.map((o) => o.dispatchDistanceKm);
    assert.ok(distances[0] < distances[1]);
    assert.ok(distances[1] < distances[2]);

    // Use the same full-precision distance the server prices off, not the
    // display-rounded res.body.distanceKm (rounded to 1 decimal for the UI).
    const preciseDistanceKm = haversineKm(TEST_PICKUP.lat, TEST_PICKUP.lng, TEST_DESTINATION.lat, TEST_DESTINATION.lng);
    const opA = res.body.operators.find((o) => o.operatorId === operators.A.id);
    const expectedSubtotal = Math.round((operators.A.baseFare + operators.A.perKmRate * preciseDistanceKm) * 100) / 100;
    assert.equal(opA.price.subtotal, expectedSubtotal);
  });

  await t.test("booking the nearest operator creates exactly one pending offer", async () => {
    const res = await client
      .post("/api/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "Cash" });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "offered");
    assert.equal(res.body.operatorId, operators.A.id);
    bookingId = res.body.id;
    offerAId = res.body.currentOffer.id;

    const offers = await prisma.bookingOffer.findMany({ where: { bookingId } });
    assert.equal(offers.length, 1);
    assert.equal(offers[0].status, "pending");
  });

  await t.test("decline advances to the next nearest operator (B)", async () => {
    const tokenA = await operatorToken(operators.A.email, FIXTURE_PASSWORD);
    const res = await client.post(`/api/operator/offers/${offerAId}/decline`).set("Authorization", `Bearer ${tokenA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "offered");
    assert.equal(res.body.nextOperatorId, operators.B.id);

    const offers = await prisma.bookingOffer.findMany({ where: { bookingId }, orderBy: { sequence: "asc" } });
    assert.equal(offers.length, 2);
    assert.equal(offers[0].status, "declined");
    assert.equal(offers[1].status, "pending");
    assert.equal(offers[1].operatorId, operators.B.id);

    const events = await prisma.trackingEvent.findMany({ where: { bookingId } });
    assert.ok(events.some((e) => e.label.includes("Searching Next")));
  });

  await t.test("a simulated timeout on B advances to the next nearest operator (C)", async () => {
    const offers = await prisma.bookingOffer.findMany({ where: { bookingId } });
    const offerB = offers.find((o) => o.operatorId === operators.B.id);

    await expireOffer(offerB.id);

    const updated = await prisma.bookingOffer.findMany({ where: { bookingId } });
    assert.equal(updated.find((o) => o.operatorId === operators.B.id).status, "timed_out");
    assert.equal(updated.find((o) => o.operatorId === operators.C.id).status, "pending");

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    assert.equal(booking.status, "offered");
    assert.equal(booking.operatorId, operators.C.id);
  });

  let tokenC;

  await t.test("accept sets the booking to accepted", async () => {
    tokenC = await operatorToken(operators.C.email, FIXTURE_PASSWORD);
    const offerC = await prisma.bookingOffer.findFirst({ where: { bookingId, operatorId: operators.C.id } });

    const res = await client.post(`/api/operator/offers/${offerC.id}/accept`).set("Authorization", `Bearer ${tokenC}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "accepted");
  });

  await t.test("status advances forward-only, only by the assigned operator", async () => {
    for (const status of ["enroute", "arrived", "onboard", "completed"]) {
      const res = await client
        .post(`/api/bookings/${bookingId}/status`)
        .set("Authorization", `Bearer ${tokenC}`)
        .send({ status });
      assert.equal(res.status, 200, `expected 200 advancing to ${status}`);
      assert.equal(res.body.status, status);
    }

    const repeat = await client
      .post(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ status: "enroute" });
    assert.equal(repeat.status, 409);

    const tokenA = await operatorToken(operators.A.email, FIXTURE_PASSWORD);
    const wrongOperator = await client
      .post(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "completed" });
    assert.equal(wrongOperator.status, 403);
  });

  await t.test("tracking timeline is complete and chronological", async () => {
    const res = await client.get(`/api/bookings/${bookingId}/tracking`).set("Authorization", `Bearer ${patientToken}`);
    assert.equal(res.status, 200);

    assert.deepEqual(
      res.body.map((e) => e.label),
      [
        "Booking Requested",
        "Offer Sent to Fixture Operator A",
        "Operator Declined — Searching Next",
        "Offer Sent to Fixture Operator B",
        "Operator Declined — Searching Next",
        "Offer Sent to Fixture Operator C",
        "Accepted",
        "En Route",
        "Arrived",
        "Patient Onboard",
        "Completed",
      ]
    );

    const times = res.body.map((e) => new Date(e.createdAt).getTime());
    for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1]);
  });
});
