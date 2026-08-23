import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import app from "../src/index.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("GET / reports that the API is alive", async () => {
  const res = await app.request("/");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "Kiyoko — Sukebei Nyaa API v1 // Alive");
});

test("GET /id/:id rejects non-numeric IDs", async () => {
  const res = await app.request("/id/12abc");
  assert.equal(res.status, 400);
  assert.equal(await res.text(), "Invalid ID");
});

test("GET /user/:username rejects path-like usernames", async () => {
  const res = await app.request("/user/has.dot");
  assert.equal(res.status, 400);
  assert.equal(await res.text(), "Invalid username");
});

test("GET /:category rejects unknown categories", async () => {
  const res = await app.request("/software");
  assert.equal(res.status, 400);
  assert.equal(await res.text(), "Invalid category");
});

test("GET /id/:id maps upstream 404 to 404", async () => {
  globalThis.fetch = (async () =>
    new Response("missing", { status: 404 })) as typeof fetch;

  const res = await app.request("/id/999999");
  assert.equal(res.status, 404);
  assert.equal(await res.text(), "Not Found");
});

test("GET /art maps upstream failures to 502 after trying both mirrors", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("blocked", { status: 503 });
  }) as typeof fetch;

  const res = await app.request("/art");
  assert.equal(res.status, 502);
  assert.equal(calls, 2);
});
