import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION } from "./helpers/testDb.js";
import { client, guestToken } from "./helpers/client.js";
import { expireOffer } from "../src/services/offerEngine.js";
import { prisma } from "../src/lib/prisma.js";

test("cancel while offered", async () => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();

  const bookRes = await client
    .post("/api/bookings")
    .set("Authorization", `Bearer ${patientToken}`)
    .send({ operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "Cash" });
  const bookingId = bookRes.body.id;
  const offerId = bookRes.body.currentOffer.id;

  const cancelRes = await client.post(`/api/bookings/${bookingId}/cancel`).set("Authorization", `Bearer ${patientToken}`);
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.status, "cancelled");

  const offer = await prisma.bookingOffer.findUnique({ where: { id: offerId } });
  assert.equal(offer.status, "cancelled");

  // A stray expire on an already-cancelled offer (e.g. the sweep racing a
  // cancel) must be a harmless no-op, not a double-transition.
  await expireOffer(offerId);
  const offerAfter = await prisma.bookingOffer.findUnique({ where: { id: offerId } });
  assert.equal(offerAfter.status, "cancelled");
  const bookingAfter = await prisma.booking.findUnique({ where: { id: bookingId } });
  assert.equal(bookingAfter.status, "cancelled");
});

test("no operators left -> expired (999 fallback), no further offers created", async () => {
  await resetDb();
  // Deliberately seed nothing eligible for this pickup point.
  const patientToken = await guestToken();

  const quoteRes = await client
    .post("/api/bookings/quote")
    .set("Authorization", `Bearer ${patientToken}`)
    .send({ pickup: TEST_PICKUP, destination: TEST_DESTINATION });
  assert.equal(quoteRes.body.operators.length, 0);

  const bookRes = await client
    .post("/api/bookings")
    .set("Authorization", `Bearer ${patientToken}`)
    .send({
      operatorId: "does-not-exist",
      pickup: TEST_PICKUP,
      destination: TEST_DESTINATION,
      paymentMethod: "Cash",
    });

  assert.equal(bookRes.status, 201);
  assert.equal(bookRes.body.status, "expired");
  assert.equal(bookRes.body.currentOffer, null);

  const offers = await prisma.bookingOffer.findMany({ where: { bookingId: bookRes.body.id } });
  assert.equal(offers.length, 0);

  const events = await prisma.trackingEvent.findMany({ where: { bookingId: bookRes.body.id } });
  assert.ok(events.some((e) => e.label.includes("No Operators Left")));
});
