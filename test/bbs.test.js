import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

test("the shipped BBS keeps its complete interaction contract", async () => {
  const html = await readFile(new URL("../examples/bbs.html", import.meta.url), "utf8");
  const source = html.match(/<script id="app" type="text\/perl">([\s\S]*?)<\/script>/)[1];
  const elements = Object.fromEntries(["name", "message", "search", "posts", "count", "post"].map(id => [`#${id}`, new FakeElement()]));
  const runtime = new Runtime({ io: new BrowserIO(createFakeDocument(elements).document) });
  runtime.run(source);

  assert.equal(elements["#count"].textContent, "0");
  elements["#message"].value = "first";
  elements["#post"].emit("click");
  elements["#name"].value = "coji";
  elements["#message"].value = "Perl at YAPC";
  elements["#message"].emit("keydown");
  elements["#message"].value = "";
  elements["#post"].emit("click");

  assert.equal(elements["#count"].textContent, "2");
  assert.equal(elements["#message"].value, "");
  assert.equal(elements["#posts"].textContent, "anonymous\tfirst\ncoji\tPerl at YAPC\n");

  elements["#search"].value = "perl|yapc";
  elements["#search"].emit("input");
  assert.equal(elements["#posts"].textContent, "coji\tPerl at YAPC\n");

  elements["#message"].value = "IME must not post";
  elements["#message"].emit("keydown", { isComposing: true });
  elements["#message"].emit("keydown", { keyCode: 229 });
  assert.equal(elements["#count"].textContent, "2");
});
