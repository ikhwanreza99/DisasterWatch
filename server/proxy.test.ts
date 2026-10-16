import { test } from "node:test";
import assert from "node:assert/strict";
import { createAiProxy } from "./aiProxy";
import { createFirmsProxy } from "./firmsProxy";
import express from "express";

async function withServer(
  app: express.Express,
  run: (base: string) => Promise<void>,
) {
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

test("ai proxy never exposes a key and returns 503 when unconfigured", async () => {
  await withServer(createAiProxy({ key: "" }), async (base) => {
    const res = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization:"Bearer test-token" },
      body: JSON.stringify({ model: "gemini-3.8-flash", prompt: "hi" }),
    });
    assert.equal(res.status, 503);
    const body = await res.text();
    assert.doesNotMatch(body, /AIza/);
  });
});

test("ai proxy validates input and forwards to Gemini with the server key", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  await withServer(createAiProxy({ key: "server-key", fetchImpl, authenticate:async()=>"test-user" }), async (base) => {
    const bad = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization:"Bearer test-token" },
      body: JSON.stringify({ prompt: "no model" }),
    });
    assert.equal(bad.status, 400);

    const ok = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization:"Bearer test-token" },
      body: JSON.stringify({ model: "gemini-3.8-flash", prompt: "hi" }),
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), {
      candidates: [{ content: { parts: [{ text: "OK" }] } }],
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["x-goog-api-key"], "server-key");
  });
});

test("firms proxy validates the path and injects the server key", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response("latitude,longitude\n1,2", {
      status: 200,
      headers: { "Content-Type": "text/csv" },
    });
  }) as typeof fetch;

  await withServer(createFirmsProxy({ key: "firms-key", fetchImpl }), async (base) => {
    const bad = await fetch(`${base}/../etc/passwd`);
    assert.notEqual(bad.status, 200);

    const ok = await fetch(`${base}/VIIRS_SNPP_NRT/92,-13.5,143,9/5/2026-10-01`);
    assert.equal(ok.status, 200);
    assert.match(await ok.text(), /^latitude/);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /firms\.modaps\.eosdis\.nasa\.gov/);
    assert.match(calls[0], /firms-key/);
  });
});

test("firms proxy returns 503 when no key is configured", async () => {
  await withServer(createFirmsProxy({ key: "" }), async (base) => {
    const res = await fetch(`${base}/VIIRS_SNPP_NRT/92,-13.5,143,9/5/2026-10-01`);
    assert.equal(res.status, 503);
  });
});

test('configured AI proxy rejects unauthenticated callers before spending quota',async()=>{
 let calls=0;await withServer(createAiProxy({key:'secret-key',fetchImpl:(async()=>{calls++;return new Response('{}');}) as typeof fetch}),async base=>{
 const r=await fetch(`${base}/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'gemini-3.8-flash',prompt:'hi'})});assert.equal(r.status,401);assert.equal(calls,0);
 });
});
test('upstream failures cannot echo server secrets into browser responses',async()=>{
 await withServer(createAiProxy({key:'test-private-secret',authenticate:async()=>'user',fetchImpl:(async()=>new Response('test-private-secret',{status:403})) as typeof fetch}),async base=>{
 const r=await fetch(`${base}/generate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test'},body:JSON.stringify({model:'gemini-3.8-flash',prompt:'hi'})});assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/test-private-secret/);
 });
});
