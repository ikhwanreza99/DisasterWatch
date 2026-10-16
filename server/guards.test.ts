import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createOriginGuard, createRateLimiter } from "./guards";

async function withServer(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
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

test("origin guard blocks disallowed browsers but allows same-origin/server calls", async () => {
  const app = express();
  app.use("/api", createOriginGuard(["https://ok.example"]), (_req, res) => res.json({ ok: true }));
  await withServer(app, async (base) => {
    const bad = await fetch(`${base}/api`, { headers: { Origin: "https://evil.example" } });
    assert.equal(bad.status, 403);
    const good = await fetch(`${base}/api`, { headers: { Origin: "https://ok.example" } });
    assert.equal(good.status, 200);
    const none = await fetch(`${base}/api`);
    assert.equal(none.status, 200);
  });
});

test("rate limiter returns 429 after the limit within the window", async () => {
  const app = express();
  app.use("/api", createRateLimiter({ windowMs: 60_000, max: 3 }), (_req, res) => res.json({ ok: true }));
  await withServer(app, async (base) => {
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(`${base}/api`)).status);
    assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  });
});
