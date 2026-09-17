import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
import { resetDb } from "./helpers/testDb.js";
import { client } from "./helpers/client.js";

const TOKEN = process.env.ADMIN_API_TOKEN;
const PASSWORD = "correct-horse-battery";

// Admin accounts (2026-09-18) replace the shared ADMIN_API_TOKEN as the
// day-to-day login; the token stays as break-glass access and is what
// creates the first account.
test("admin users: bootstrap, login, disable, break-glass token", async (t) => {
  await resetDb();
  await prisma.adminUser.deleteMany();

  await t.test("the shared token creates the first account", async () => {
    const res = await client
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ email: "Founder@Lifeline.test ", name: "Founder", password: PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, "founder@lifeline.test"); // normalised
    assert.equal(res.body.disabled, false);
    assert.ok(!("passwordHash" in res.body), "password hash must never be returned");
  });

  await t.test("short passwords are rejected", async () => {
    const res = await client
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ email: "weak@lifeline.test", name: "Weak", password: "short" });
    assert.equal(res.status, 400);
  });

  let adminToken;
  await t.test("the account logs in and its JWT works on admin routes", async () => {
    const login = await client
      .post("/api/auth/admin/login")
      .send({ email: " FOUNDER@lifeline.test", password: PASSWORD });
    assert.equal(login.status, 200);
    adminToken = login.body.token;
    assert.ok(adminToken);

    const operators = await client.get("/api/admin/operators").set("Authorization", `Bearer ${adminToken}`);
    assert.equal(operators.status, 200);
  });

  await t.test("wrong password and unknown email both 401", async () => {
    const wrong = await client
      .post("/api/auth/admin/login")
      .send({ email: "founder@lifeline.test", password: "not-the-password" });
    assert.equal(wrong.status, 401);
    const unknown = await client
      .post("/api/auth/admin/login")
      .send({ email: "nobody@lifeline.test", password: PASSWORD });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.error.code, "invalid_credentials"); // never "no such user"
  });

  await t.test("the last enabled admin cannot be disabled", async () => {
    const me = await client.get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`);
    const founder = me.body.users.find((u) => u.email === "founder@lifeline.test");
    assert.equal(me.body.currentAdminUserId, founder.id);

    const res = await client
      .patch(`/api/admin/users/${founder.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ disabled: true });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "cannot_disable_self");
  });

  await t.test("a disabled admin can neither log in nor use an existing token", async () => {
    const second = await client
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "staff@lifeline.test", name: "Staff", password: PASSWORD });
    assert.equal(second.status, 201);

    const staffLogin = await client
      .post("/api/auth/admin/login")
      .send({ email: "staff@lifeline.test", password: PASSWORD });
    const staffToken = staffLogin.body.token;
    assert.equal(staffLogin.status, 200);

    const off = await client
      .patch(`/api/admin/users/${second.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ disabled: true });
    assert.equal(off.status, 200);
    assert.equal(off.body.disabled, true);

    // Already-issued JWT stops working immediately, not at expiry.
    const reuse = await client.get("/api/admin/operators").set("Authorization", `Bearer ${staffToken}`);
    assert.equal(reuse.status, 401);

    const relogin = await client
      .post("/api/auth/admin/login")
      .send({ email: "staff@lifeline.test", password: PASSWORD });
    assert.equal(relogin.status, 401);
  });

  await t.test("password reset lets the user back in", async () => {
    const list = await client.get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`);
    const staff = list.body.users.find((u) => u.email === "staff@lifeline.test");
    const res = await client
      .patch(`/api/admin/users/${staff.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ disabled: false, password: "brand-new-password" });
    assert.equal(res.status, 200);

    const login = await client
      .post("/api/auth/admin/login")
      .send({ email: "staff@lifeline.test", password: "brand-new-password" });
    assert.equal(login.status, 200);
  });

  await t.test("repeated failures lock that email out", async () => {
    for (let i = 0; i < 5; i++) {
      await client.post("/api/auth/admin/login").send({ email: "staff@lifeline.test", password: "wrong" });
    }
    const locked = await client
      .post("/api/auth/admin/login")
      .send({ email: "staff@lifeline.test", password: "brand-new-password" }); // correct, still locked
    assert.equal(locked.status, 429);
    assert.equal(locked.body.error.code, "too_many_attempts");
  });

  await t.test("garbage credentials are refused", async () => {
    const res = await client.get("/api/admin/users").set("Authorization", "Bearer not-a-real-token");
    assert.equal(res.status, 401);
    const none = await client.get("/api/admin/users");
    assert.equal(none.status, 401);
  });
});
