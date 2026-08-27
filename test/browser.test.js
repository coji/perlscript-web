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

test("close and reopen remove event listeners owned by the handle", () => {
  const button = new FakeElement();
  const { document } = createFakeDocument({ "#button": button });
  const io = new BrowserIO(document);
  let calls = 0;
  io.open("CLICK", "event:click:#button");
  io.watch("CLICK", "first", () => { calls++; });
  io.close("CLICK");
  button.emit("click");
  assert.equal(calls, 0);
  assert.equal(button.listenerCount("click"), 0);

  io.open("CLICK", "event:click:#button");
  io.watch("CLICK", "second", () => { calls++; });
  io.open("CLICK", "event:click:#button");
  assert.equal(button.listenerCount("click"), 0);
});

test("closing a UI handle disposes renderer-owned listeners", () => {
  const root = new FakeElement();
  const { document } = createFakeDocument({ "#app": root });
  const runtime = new Runtime({ io: new BrowserIO(document) });
  runtime.run(`
    sub clicked { }
    sub view { begin("button"); on("click", "clicked"); text("Click"); end(); }
    open APP, ">ui:#app";
    mount(APP, "view");
  `);
  const button = root.childNodes[0];
  assert.equal(button.listenerCount("click"), 1);
  runtime.call("close", ["APP"]);
  assert.equal(button.listenerCount("click"), 0);
  runtime.scalars.changed = 1;
  runtime.markDirty();
  assert.doesNotThrow(() => runtime.flushUI());
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

test("bridges registered bidirectional streams through ordinary filehandle I/O", () => {
  const { document } = createFakeDocument();
  let sink;
  const writes = [];
  let closed = false;
  const io = new BrowserIO(document, { streams: {
    chat(next) {
      sink = next;
      return { write(value) { writes.push(value); }, close() { closed = true; } };
    },
  } });
  const runtime = new Runtime({ io });
  runtime.run(`
    $answer = ""; $done = 0;
    sub receive { if (eof(CHAT)) { $done = 1; } else { $answer = $answer . <CHAT>; } }
    open CHAT, "stream:chat";
    do watch(CHAT, "receive");
    print CHAT "hello";
  `);
  assert.deepEqual(writes, ["hello"]);
  sink.emit("hel");
  sink.emit("lo");
  assert.equal(runtime.scalars.answer, "hello");
  assert.equal(runtime.scalars.done, 0);
  sink.end();
  assert.equal(runtime.scalars.done, 1);
  runtime.dispose();
  assert.equal(closed, true);
});

test("rejects unknown and malformed stream filehandles", () => {
  const { document } = createFakeDocument();
  const io = new BrowserIO(document);
  assert.throws(() => io.open("BAD", "stream:missing"), /Unknown browser stream missing/);
  assert.throws(() => io.open("BAD", ">stream:missing"), /bidirectional/);
});

test("reads and replaces local and session storage through filehandles", () => {
  const createStorage = entries => {
    const values = new Map(entries);
    return {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
      values,
    };
  };
  const local = createStorage([["perlgpt/chats", '[{"id":1}]']]);
  const session = createStorage();
  const { document } = createFakeDocument();
  const runtime = new Runtime({ io: new BrowserIO(document, { storage: { local, session } }) });
  runtime.run(`
    open OLD, "storage:local:perlgpt/chats";
    $old = <OLD>;
    open HISTORY, ">storage:local:perlgpt/chats";
    print HISTORY "[";
    print HISTORY '{"id":2}]';
    open DRAFT, ">storage:session:perlgpt/draft";
    print DRAFT "temporary";
  `);
  assert.equal(runtime.scalars.old, '[{"id":1}]');
  assert.equal(local.values.get("perlgpt/chats"), '[{"id":2}]');
  assert.equal(session.values.get("perlgpt/draft"), "temporary");
  assert.throws(() => runtime.io.write("OLD", "x"), /read-only storage/);
});

test("rejects malformed storage filehandles", () => {
  const { document } = createFakeDocument();
  const io = new BrowserIO(document);
  for (const spec of ["storage:", "storage:local:", "storage:other:key"]) {
    assert.throws(() => io.open("BAD", spec), /Invalid browser filehandle spec/);
  }
});

test("owns replaceable and appendable CSS through filehandles", () => {
  const { document } = createFakeDocument();
  const runtime = new Runtime({ io: new BrowserIO(document) });
  runtime.run(`
    open STYLE, ">css:perlgpt";
    print STYLE ".chat { color: red; }";
    open MORE, ">>css:perlgpt";
    print MORE ".button { color: blue; }";
  `);
  const style = document.head.childNodes[0];
  assert.equal(style.getAttribute("data-perlscript-css"), "perlgpt");
  assert.equal(style.textContent, ".chat { color: red; }.button { color: blue; }");

  runtime.io.open("RESET", ">css:perlgpt");
  runtime.io.write("RESET", ".new { display: grid; }");
  assert.equal(style.textContent, ".new { display: grid; }");
  runtime.dispose();
  assert.equal(document.head.childNodes.length, 0);
});

test("rejects malformed CSS filehandles", () => {
  const { document } = createFakeDocument();
  const io = new BrowserIO(document);
  for (const spec of ["css:theme", ">css:", ">css:bad name", ">>dom:#out"]) {
    assert.throws(() => io.open("BAD", spec), /Invalid browser filehandle spec/);
  }
});

function fakeNavigation() {
  const listeners = new Map();
  const location = { hash: "#/", pathname: "/", search: "" };
  const navigation = {
    location,
    history: { pushState(_state, _title, route) {
      const url = new URL(route, "https://example.test");
      location.pathname = url.pathname;
      location.search = url.search;
      location.hash = url.hash;
    } },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    emit(type) { for (const listener of [...(listeners.get(type) || [])]) listener(); },
    listenerCount(type) { return listeners.get(type)?.size || 0; },
  };
  return navigation;
}

test("routes through hash and history filehandles and observes browser navigation", () => {
  const { document } = createFakeDocument();
  const navigation = fakeNavigation();
  const io = new BrowserIO(document, { navigation });
  const changes = [];

  io.open("HASH", "route:hash");
  io.watch("HASH", "changed", () => changes.push(io.read("HASH")));
  assert.equal(io.read("HASH"), "/");
  io.write("HASH", "/test/read.cgi/perl/123?last=50");
  assert.equal(navigation.location.hash, "#/test/read.cgi/perl/123?last=50");
  assert.deepEqual(changes, ["/test/read.cgi/perl/123?last=50"]);
  navigation.location.hash = "#/board/perl";
  navigation.emit("hashchange");
  assert.deepEqual(changes, ["/test/read.cgi/perl/123?last=50", "/board/perl"]);

  io.open("HISTORY", "route:history");
  io.open("HISTORY_COPY", "route:history");
  const historyChanges = [];
  const copiedHistoryChanges = [];
  io.watch("HISTORY", "changed", () => historyChanges.push(io.read("HISTORY")));
  io.watch("HISTORY_COPY", "copied", () => copiedHistoryChanges.push(io.read("HISTORY_COPY")));
  io.write("HISTORY", "/diary/42?comment=1");
  assert.equal(io.read("HISTORY"), "/diary/42?comment=1");
  assert.deepEqual(copiedHistoryChanges, ["/diary/42?comment=1"]);
  navigation.location.pathname = "/home";
  navigation.location.search = "";
  navigation.location.hash = "";
  navigation.emit("popstate");
  assert.deepEqual(historyChanges, ["/diary/42?comment=1", "/home"]);
  assert.deepEqual(copiedHistoryChanges, ["/diary/42?comment=1", "/home"]);
  assert.throws(() => io.write("HISTORY", "https://example.com/escape"), /Invalid route/);
  assert.throws(() => io.write("HISTORY", "//example.com/escape"), /Invalid route/);
  io.dispose();
  assert.equal(navigation.listenerCount("hashchange"), 0);
  assert.equal(navigation.listenerCount("popstate"), 0);
});

test("stages storage and route effects until commit and discards them on rollback", () => {
  const values = new Map([["state", "before"]]);
  const local = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  const { document } = createFakeDocument();
  const navigation = fakeNavigation();
  navigation.location.pathname = "/before";
  navigation.location.hash = "";
  const io = new BrowserIO(document, { storage: { local }, navigation });

  io.beginEffects();
  io.open("DATA", ">storage:local:state");
  io.write("DATA", "after");
  io.open("ROUTE", "route:history");
  io.write("ROUTE", "/after");
  assert.equal(values.get("state"), "before");
  assert.equal(navigation.location.pathname, "/before");
  assert.equal(io.read("DATA"), "after");
  assert.equal(io.read("ROUTE"), "/after");
  io.rollbackEffects();
  assert.equal(values.get("state"), "before");
  assert.equal(navigation.location.pathname, "/before");

  io.beginEffects();
  io.clear("DATA");
  io.write("DATA", "committed");
  io.write("ROUTE", "/committed");
  io.commitEffects();
  assert.equal(values.get("state"), "committed");
  assert.equal(navigation.location.pathname, "/committed");
});

test("clock ticks rerenderable Perl state and disposes its timer", () => {
  const { document } = createFakeDocument();
  let now = 1_787_788_800_000;
  let tick = null;
  let cleared = false;
  const clock = {
    now: () => now,
    setInterval(callback, interval) { assert.equal(interval, 60_000); tick = callback; return 7; },
    clearInterval(timer) { assert.equal(timer, 7); cleared = true; },
  };
  const runtime = new Runtime({ io: new BrowserIO(document, { clock }) });
  runtime.run(`
    $ticks = 0;
    open CLOCK, "clock:60000";
    $now = <CLOCK>;
    sub update_clock { $now = <CLOCK>; $ticks++; }
    do watch(CLOCK, "update_clock");
  `);
  assert.equal(runtime.scalars.now, "1787788800");
  now += 60_000;
  tick();
  assert.equal(runtime.scalars.now, "1787788860");
  assert.equal(runtime.scalars.ticks, 1);
  runtime.dispose();
  assert.equal(cleared, true);
});

test("rejects malformed route and clock filehandles", () => {
  const { document } = createFakeDocument();
  const io = new BrowserIO(document, { navigation: fakeNavigation() });
  for (const spec of ["route:", "route:path", ">route:hash", "clock:", "clock:0", "clock:15", "clock:86400001", ">clock:1000"]) {
    assert.throws(() => io.open("BAD", spec), /Invalid browser filehandle spec|Invalid clock interval/);
  }
});
