import test from "node:test";
import assert from "node:assert/strict";
import { createWebAdapters } from "../src/web-adapters.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values,
  };
};

test("web adapters keep credentials out of Perl requests and support persistence", async () => {
  const storage = createStorage();
  let fetched;
  const adapters = createWebAdapters({
    storage,
    fetch: async (url, options) => {
      fetched = { url, options };
      return { ok: true, status: 200, text: async () => "ok" };
    },
  });
  const secretEvents = [];
  adapters.secret({ emit: value => secretEvents.push(JSON.parse(value)), end() {} }).write(JSON.stringify({ op: "set", name: "service", value: "private", persist: true }));
  assert.equal(storage.values.get("perlscript-web:secret:service"), "private");
  assert.deepEqual(secretEvents[0], { type: "secret.result", op: "set", name: "service", configured: true, persisted: true });

  const httpEvents = [];
  await new Promise(resolve => {
    adapters.http({ emit: value => httpEvents.push(JSON.parse(value)), end: resolve }).write(JSON.stringify({
      method: "POST",
      url: "https://example.test/api",
      credential: "service",
      body: { hello: "world" },
    }));
  });
  assert.equal(fetched.url, "https://example.test/api");
  assert.equal(fetched.options.headers.get("Authorization"), "Bearer private");
  assert.equal(fetched.options.body, '{"hello":"world"}');
  assert.deepEqual(httpEvents, [{ type: "http.response", status: 200, body: "ok" }]);
});

test("web adapters decode SSE chunks and report missing credentials", async () => {
  const encoder = new TextEncoder();
  const adapters = createWebAdapters({
    storage: createStorage(),
    fetch: async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"delta":"hel"}\n\n'));
          controller.enqueue(encoder.encode('data: {"delta":"lo"}\n\ndata: [DONE]\n\n'));
          controller.close();
        },
      }),
    }),
  });
  const missing = [];
  await new Promise(resolve => adapters.http({ emit: value => missing.push(JSON.parse(value)), end: resolve }).write(JSON.stringify({ url: "https://example.test", credential: "missing" })));
  assert.equal(missing[0].code, "credential_missing");

  const chunks = [];
  await new Promise(resolve => adapters.http({ emit: value => chunks.push(JSON.parse(value)), end: resolve }).write(JSON.stringify({ url: "https://example.test", stream: "sse" })));
  assert.deepEqual(chunks, [{ delta: "hel" }, { delta: "lo" }]);
});
