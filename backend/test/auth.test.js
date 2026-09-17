import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, seedFixtureOperators, FIXTURE_PASSWORD } from "./helpers/testDb.js";
import { client } from "./helpers/client.js";

// Operators type their email on a phone keyboard — a stray capital or
// trailing space must not fail the login.
test("operator login ignores email case and surrounding spaces", async () => {
  await resetDb();
  await seedFixtureOperators();

  const ok = await client
    .post("/api/auth/operator/login")
    .send({ email: "  Fixture-A@Test.Example ", password: FIXTURE_PASSWORD });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const wrongPassword = await client
    .post("/api/auth/operator/login")
    .send({ email: "fixture-a@test.example", password: "not-the-password" });
  assert.equal(wrongPassword.status, 401);
});
