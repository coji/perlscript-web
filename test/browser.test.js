import test from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

function fixture() {
  const elements = { "#message": new FakeElement("hello"), "#posts": new FakeElement(), "#post": new FakeElement() };
  return { elements, document: createFakeDocument(elements).document };
}

test("bridges DOM values, output, click, and Enter", () => {
  const { elements, document } = fixture();
  const runtime = new Runtime({ io: new BrowserIO(document) });
  runtime.run(`
    open MESSAGE, "dom:#message";
    open POSTS, ">dom:#posts";
    open CLICK, "event:click:#post";
    open ENTER, "event:keydown:#message";
    sub post { $message = <MESSAGE>; select POSTS; print $message, "\\n"; }
    do watch(CLICK, "post");
    do watch(ENTER, "post");
  `);
  elements["#post"].emit("click");
  elements["#message"].emit("keydown");
  assert.equal(elements["#posts"].textContent, "hello\nhello\n");
});

test("ignores Enter during IME composition and removes listeners", () => {
  const { elements, document } = fixture();
  const runtime = new Runtime({ io: new BrowserIO(document) });
  runtime.run(`open ENTER, "event:keydown:#message"; sub post { print "x"; } do watch(ENTER, "post");`);
  elements["#message"].emit("keydown", { isComposing: true });
  elements["#message"].emit("keydown", { keyCode: 229 });
  assert.equal(runtime.io.read("STDOUT"), "");
  runtime.dispose();
  assert.equal(elements["#message"].listenerCount(), 0);
});

test("preserves complete DOM and event selectors containing colons", () => {
  const target = new FakeElement();
  const { document, requestedSelectors } = createFakeDocument({
    "input:checked": target,
    '.item[data-id="a:b"]': target,
  });
  const io = new BrowserIO(document);
  io.open("CHECKED", "dom:input:checked");
  io.open("ITEM", 'event:click:.item[data-id="a:b"]');
  assert.deepEqual(requestedSelectors, ["input:checked", '.item[data-id="a:b"]']);
});

test("rejects malformed browser filehandle specs", () => {
  const { document } = createFakeDocument();
  const io = new BrowserIO(document);
  for (const spec of ["dom:", "event:click", "event::#button", ">event:click:#button"]) {
    assert.throws(() => io.open("BAD", spec), /Invalid browser filehandle spec/);
  }
});

test("appends DOM output as text in exact print order", () => {
  const out = new FakeElement();
  const { document } = createFakeDocument({ "#out": out });
  const io = new BrowserIO(document);
  io.open("OUT", ">dom:#out");
  for (let i = 0; i < 100; i++) io.write("OUT", String(i % 10));
  assert.equal(out.textContent, "0123456789".repeat(10));
  assert.equal(out.appendCalls, 100);
});
