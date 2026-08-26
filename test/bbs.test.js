import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

test("the shipped BBS keeps its complete interaction contract", async () => {
  const html = await readFile(new URL("../examples/bbs.html", import.meta.url), "utf8");
  const source = html.match(/<script id="app"[^>]*>([\s\S]*?)<\/script>/)[1];
  const root = new FakeElement();
  const runtime = new Runtime({ io: new BrowserIO(createFakeDocument({ "#app-root": root }).document) });
  runtime.run(source);
  /** @param {string} id */
  const byId = id => {
    /** @param {*} node @returns {*} */
    const visit = node => node.attributes?.get("id") === id ? node : node.childNodes?.map(visit).find(Boolean);
    return visit(root);
  };

  assert.equal(byId("count").textContent, "0");
  byId("message").value = "first";
  byId("message").emit("input");
  byId("post").parentNode.emit("submit");
  byId("name").value = "coji";
  byId("name").emit("input");
  byId("message").value = "Perl at YAPC";
  byId("message").emit("input");
  byId("post").parentNode.emit("submit");

  assert.equal(byId("count").textContent, "2");
  assert.equal(byId("message").value, "");
  assert.equal(byId("posts").textContent, "anonymous\tfirst\ncoji\tPerl at YAPC\n");

  byId("search").value = "perl|yapc";
  byId("search").emit("input");
  assert.equal(byId("posts").textContent, "coji\tPerl at YAPC\n");
});
