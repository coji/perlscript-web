import test from "node:test";
import assert from "node:assert/strict";
import { run, runScripts, disposeScript, setErrorHandler, registerStream } from "../src/browser.js";
import { FakeElement, createFakeDocument, createPerlScript } from "./helpers/fake-dom.js";

const program = 'open OUT, ">dom:#out"; open CLICK, "event:click:#button"; sub post { print OUT "x"; } do watch(CLICK, "post");';

function fixture(source = program) {
  const out = new FakeElement();
  const button = new FakeElement();
  const state = createFakeDocument({ "#out": out, "#button": button });
  const script = createPerlScript(state.document, source);
  state.scripts.push(script);
  return { ...state, script, out, button };
}

test("run executes source and returns a disposable runtime", () => {
  const { document, button, out } = fixture();
  const runtime = run(program, { document });
  button.emit("click");
  assert.equal(out.textContent, "x");
  runtime.dispose();
  assert.equal(button.listenerCount(), 0);
});

test("runScripts executes inline scripts in document order", async () => {
  const state = fixture('open OUT, ">dom:#out"; print OUT "a";');
  state.scripts.push(createPerlScript(state.document, 'open OUT, ">dom:#out"; print OUT "b";'));
  const runtimes = await runScripts(state.document);
  assert.equal(runtimes.length, 2);
  assert.equal(state.out.textContent, "ab");
  for (const script of state.scripts) disposeScript(script);
});

test("runScripts loads external source and rejects HTTP errors", async () => {
  const state = fixture("");
  state.script.src = "https://example.test/app.pl";
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, text: async () => 'open OUT, ">dom:#out"; print OUT "external";' });
    await runScripts(state.document);
    assert.equal(state.out.textContent, "external");
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(runScripts(state.document), /Unable to load/);
  } finally {
    disposeScript(state.script);
    globalThis.fetch = originalFetch;
  }
});

test("failed run disposes listeners created before the error", () => {
  const state = fixture();
  assert.throws(() => run(`${program} do missing();`, { document: state.document }), /Undefined subroutine/);
  assert.equal(state.button.listenerCount(), 0);
});

test("failed rerun preserves the previous runtime", async () => {
  const state = fixture();
  await runScripts(state.document);
  state.script.textContent = "this is invalid;";
  await assert.rejects(runScripts(state.document), SyntaxError);
  state.button.emit("click");
  assert.equal(state.out.textContent, "x");
  disposeScript(state.script);
});

test("failed PerlUI rerun preserves the previous DOM and listener", async () => {
  const root = new FakeElement();
  const state = createFakeDocument({ "#app": root });
  const script = createPerlScript(state.document, `
    $count = 0;
    sub increment { $count++; }
    sub view { begin("button"); on("click", "increment"); text("Count: $count"); end(); }
    open APP, ">ui:#app"; mount(APP, "view");
  `);
  state.scripts.push(script);
  await runScripts(state.document);
  const button = root.childNodes[0];
  script.textContent = `sub view { begin("script"); end(); } open APP, ">ui:#app"; mount(APP, "view");`;
  await assert.rejects(runScripts(state.document), /Unsafe or invalid UI tag script/);
  assert.equal(root.childNodes[0], button);
  assert.equal(button.listenerCount("click"), 1);
  button.emit("click");
  assert.equal(root.textContent, "Count: 1");
  disposeScript(script);
});

test("failed watched actions restore Perl state and the last good UI", () => {
  const root = new FakeElement();
  const button = new FakeElement();
  const state = createFakeDocument({ "#app": root, "#trigger": button });
  const errors = [];
  const runtime = run(`
    $count = 0;
    sub broken { $count++; do missing(); }
    sub view { begin("p"); text("Count: $count"); end(); }
    open APP, ">ui:#app";
    mount(APP, "view");
    open TRIGGER, "event:click:#trigger";
    do watch(TRIGGER, "broken");
  `, { document: state.document, onError: error => errors.push(error) });

  button.emit("click");
  assert.equal(errors.length, 1);
  assert.equal(runtime.scalars.count, 0);
  assert.equal(root.textContent, "Count: 0");
  runtime.dispose();
});

test("failed reruns roll back staged storage and route writes", async () => {
  const state = fixture();
  const values = new Map([["app/state", "before"]]);
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  const location = { pathname: "/before", search: "", hash: "" };
  const listeners = new Map();
  state.document.defaultView = {
    localStorage,
    location,
    history: { pushState(_state, _title, route) { location.pathname = String(route); } },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
  await runScripts(state.document);
  state.script.textContent = `
    open DATA, ">storage:local:app/state";
    print DATA "after";
    open ROUTE, "route:history";
    print ROUTE "/after";
    do missing();
  `;
  await assert.rejects(runScripts(state.document), /Undefined subroutine/);
  assert.equal(values.get("app/state"), "before");
  assert.equal(location.pathname, "/before");
  state.button.emit("click");
  assert.equal(state.out.textContent, "x");
  disposeScript(state.script);
});

test("unregistering a stream restores the previous registration", () => {
  const { document } = createFakeDocument();
  const opened = [];
  const first = registerStream("layered", () => { opened.push("first"); return { write() {} }; });
  const second = registerStream("layered", () => { opened.push("second"); return { write() {} }; });
  try {
    run('open STREAM, "stream:layered";', { document }).dispose();
    second();
    run('open STREAM, "stream:layered";', { document }).dispose();
    assert.deepEqual(opened, ["second", "first"]);
  } finally {
    second();
    first();
  }
});

test("the newest overlapping external run wins and superseded listeners are absent", async () => {
  const state = fixture("");
  state.script.src = "https://example.test/app.pl";
  const originalFetch = globalThis.fetch;
  const pending = [];
  try {
    globalThis.fetch = () => new Promise(resolve => pending.push(resolve));
    const first = runScripts(state.document);
    const second = runScripts(state.document);
    pending[1]({ ok: true, text: async () => program.replace('"x"', '"new"') });
    await second;
    pending[0]({ ok: true, text: async () => program.replace('"x"', '"old"') });
    assert.deepEqual(await first, []);
    assert.equal(state.button.listenerCount("click"), 1);
    state.button.emit("click");
    assert.equal(state.out.textContent, "new");
  } finally {
    disposeScript(state.script);
    globalThis.fetch = originalFetch;
  }
});

test("disposeScript invalidates pending external work", async () => {
  const state = fixture("");
  state.script.src = "https://example.test/app.pl";
  const originalFetch = globalThis.fetch;
  let resolveFetch;
  try {
    globalThis.fetch = () => new Promise(resolve => { resolveFetch = resolve; });
    const pending = runScripts(state.document);
    disposeScript(state.script);
    resolveFetch({ ok: true, text: async () => program });
    assert.deepEqual(await pending, []);
    assert.equal(state.button.listenerCount(), 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the default error handler receives top-level failures", () => {
  const state = fixture();
  const errors = [];
  setErrorHandler(error => errors.push(error));
  try {
    assert.throws(() => run("do missing();", { document: state.document }), /Undefined subroutine/);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Undefined subroutine/);
  } finally {
    setErrorHandler(null);
  }
});

test("event failures are reported without removing the active listener", () => {
  const search = new FakeElement("[");
  const { document } = createFakeDocument({ "#search": search });
  const errors = [];
  const runtime = run(`
    open SEARCH, "dom:#search";
    open FIND, "event:input:#search";
    sub render { $query = <SEARCH>; print "match" if "text" =~ /$query/i; }
    do watch(FIND, "render");
  `, { document, onError: error => errors.push(error) });

  search.emit("input");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /regular expression/i);
  assert.equal(search.listenerCount("input"), 1);

  search.value = "text";
  search.emit("input");
  assert.equal(runtime.io.read("STDOUT"), "match");
  runtime.dispose();
});

test("a per-run error handler overrides the default handler", () => {
  const state = fixture();
  const defaults = [];
  const overrides = [];
  setErrorHandler(error => defaults.push(error));
  try {
    assert.throws(() => run("do missing();", { document: state.document, onError: error => overrides.push(error) }));
    assert.equal(defaults.length, 0);
    assert.equal(overrides.length, 1);
  } finally {
    setErrorHandler(null);
  }
});
