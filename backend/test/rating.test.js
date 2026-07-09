import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedFixtureOperators, TEST_PICKUP, TEST_DESTINATION, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client, guestToken, operatorToken } from "./helpers/client.js";
import { prisma } from "../src/lib/prisma.js";

async function bookAndComplete(patientToken, operatorEmail) {
  const bookRes = await client
    .post("/api/bookings")
    .set("Authorization", `Bearer ${patientToken}`)
    .send({ operatorId: (await prisma.operator.findUnique({ where: { email: operatorEmail } })).id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "Cash" });
  const bookingId = bookRes.body.id;
  const offerId = bookRes.body.currentOffer.id;

  const opToken = await operatorToken(operatorEmail, FIXTURE_PASSWORD);
  await client.post(`/api/operator/offers/${offerId}/accept`).set("Authorization", `Bearer ${opToken}`);
  for (const status of ["enroute", "arrived", "onboard", "completed"]) {
    await client.post(`/api/bookings/${bookingId}/status`).set("Authorization", `Bearer ${opToken}`).send({ status });
  }
  return bookingId;
}

test("post-trip rating", async (t) => {
  await resetDb();
  const operators = await seedFixtureOperators();
  const patientToken = await guestToken();

  await t.test("cannot rate a booking that isn't completed", async () => {
    const bookRes = await client
      .post("/api/bookings")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ operatorId: operators.A.id, pickup: TEST_PICKUP, destination: TEST_DESTINATION, paymentMethod: "Cash" });

    const res = await client
      .post(`/api/bookings/${bookRes.body.id}/rating`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ stars: 5 });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "not_completed");
  });

  await t.test("rating a completed booking updates the operator's aggregate", async () => {
    const bookingId = await bookAndComplete(patientToken, operators.B.email);

    const res = await client
      .post(`/api/bookings/${bookingId}/rating`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ stars: 4, comment: "Quick and professional." });
    assert.equal(res.status, 201);
    assert.equal(res.body.stars, 4);
    assert.equal(res.body.operator.ratingAvg, 4);
    assert.equal(res.body.operator.ratingCount, 1);

    const operator = await prisma.operator.findUnique({ where: { id: operators.B.id } });
    assert.equal(operator.ratingAvg, 4);
    assert.equal(operator.ratingCount, 1);
  });

  await t.test("rating the same booking twice is rejected", async () => {
    const bookingId = await bookAndComplete(patientToken, operators.C.email);

    const first = await client
      .post(`/api/bookings/${bookingId}/rating`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ stars: 5 });
    assert.equal(first.status, 201);

    const second = await client
      .post(`/api/bookings/${bookingId}/rating`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ stars: 2 });
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, "already_rated");

    // second attempt must not have skewed the aggregate
    const operator = await prisma.operator.findUnique({ where: { id: operators.C.id } });
    assert.equal(operator.ratingAvg, 5);
    assert.equal(operator.ratingCount, 1);
  });

  await t.test("a second, different completed trip averages correctly", async () => {
    const bookingId = await bookAndComplete(patientToken, operators.B.email);
    const res = await client
      .post(`/api/bookings/${bookingId}/rating`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ stars: 2 });
    assert.equal(res.status, 201);
    // operator B now has two ratings: 4 (first test) and 2 -> avg 3
    assert.equal(res.body.operator.ratingAvg, 3);
    assert.equal(res.body.operator.ratingCount, 2);
  });

  await t.test("stars out of range is rejected", async () => {
    const bookingId = await bookAndComplete(patientToken, operators.A.email);
    const res = await client
      .post(`/api/bookings/${bookingId}/rating`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ stars: 6 });
    assert.equal(res.status, 400);
  });
});
