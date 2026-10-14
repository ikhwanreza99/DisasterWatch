import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminApi } from "./admin";
import { validateReport } from "../src/services/ai/disasterValidation";
import { demoReports } from "../src/data/seedDemo";

async function withServer(run: (base: string) => Promise<void>) {
  const server = createAdminApi({ demo: true }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
const headers = {
  "Content-Type": "application/json",
  "X-DisasterWatch-Admin": "1",
};
const post = (base: string, path: string, body: unknown, cookie = "") =>
  fetch(base + path, {
    method: "POST",
    headers: { ...headers, Cookie: cookie },
    body: JSON.stringify(body),
  });

test("admin auth, guarded approval, concurrent status, audit fields, logout revocation", async () =>
  withServer(async (base) => {
    assert.equal(
      (await fetch(base + "/records?collection=reports")).status,
      401,
    );
    assert.equal(
      (
        await post(base, "/reports/x/approve", {
          expectedStatus: "AI_REVIEWED",
        })
      ).status,
      401,
    );
    assert.equal(
      (await post(base, "/login", { username: "Admin", password: "wrong" }))
        .status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "Admin", password: "Disaster123" }),
        })
      ).status,
      403,
    );
    const login = await post(base, "/login", {
      username: "Admin",
      password: "Disaster123",
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie")!;
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    const cookie = setCookie.split(";")[0];
    const get = (path: string) =>
      fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal((await get("/session")).status, 200);
    assert.equal((await get("/records?collection=private")).status, 400);
    const data = await (await get("/records?collection=reports")).json();
    const pending = data.rows.find(
      (r: any) => r.verificationStatus !== "VERIFIED",
    );
    assert.ok(pending);
    const approval = await post(
      base,
      `/reports/${pending.id}/approve`,
      {
        expectedStatus: pending.verificationStatus,
        note: "Sudah memeriksa sumber.",
      },
      cookie,
    );
    assert.equal(approval.status, 200);
    assert.equal((await approval.json()).reviewedBy, "Admin");
    const stored = await (
      await get("/records?collection=reports&status=VERIFIED")
    ).json();
    assert.equal(
      stored.rows.find((r: any) => r.id === pending.id).reviewNote,
      "Sudah memeriksa sumber.",
    );
    assert.equal(
      (
        await post(
          base,
          `/reports/${pending.id}/approve`,
          { expectedStatus: pending.verificationStatus },
          cookie,
        )
      ).status,
      409,
    );
    assert.equal((await post(base, "/logout", {}, cookie)).status, 200);
    assert.equal((await get("/session")).status, 401);
    assert.equal(
      (
        await post(
          base,
          `/reports/${pending.id}/approve`,
          { expectedStatus: "AI_REVIEWED" },
          cookie,
        )
      ).status,
      401,
    );
  }));

test("repeated failed logins are rate limited", async () =>
  withServer(async (base) => {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await post(base, "/login", { username: "Admin", password: "wrong" }))
          .status,
        401,
      );
    assert.equal(
      (
        await post(base, "/login", {
          username: "Admin",
          password: "Disaster123",
        })
      ).status,
      429,
    );
  }));

test("AI corroboration never grants human verification", () => {
  const candidate = { ...demoReports[0], id: "candidate", aiConfidence: 0.99 };
  const supporters = [1, 2, 3].map((i) => ({
    ...candidate,
    id: `support-${i}`,
  }));
  assert.equal(validateReport(candidate, supporters).status, "AI_REVIEWED");
});
