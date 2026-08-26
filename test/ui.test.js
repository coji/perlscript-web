import test from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { UITreeBuilder } from "../src/ui.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

function createUI(source, onError = null) {
  const root = new FakeElement();
  const { document } = createFakeDocument({ "#app": root });
  const runtime = new Runtime({ io: new BrowserIO(document), onError });
  runtime.run(source);
  return { root, runtime };
}

test("builds only structured, text-safe UI", () => {
  const builder = new UITreeBuilder();
  builder.begin("p", ["class", "message"]);
  builder.text("<strong>text only</strong>");
  builder.end();
  const tree = builder.finish();
  const node = tree.children[0];
  assert.equal(node.type, "element");
  assert.deepEqual({ ...node, attrs: { ...node.attrs }, events: { ...node.events } }, {
    type: "element",
    tag: "p",
    attrs: { class: "message" },
    events: {},
    bindings: [],
    key: null,
    children: [{ type: "text", value: "<strong>text only</strong>" }],
  });

  assert.throws(() => new UITreeBuilder().begin("script", []), /Unsafe or invalid UI tag/);
  assert.throws(() => new UITreeBuilder().begin("div", ["onclick", "evil"]), /Unsafe or invalid UI attribute/);
  assert.throws(() => new UITreeBuilder().begin("a", ["href", "javascript:evil()"]), /Unsafe URL/);
});

test("mounts a Counter and rerenders once per named event", () => {
  const { root, runtime } = createUI(`
$count = 0;
sub increment { $count++; }
sub view {
  begin("main", "class", "counter");
  begin("h1"); text("Perl Counter"); end();
  begin("button", "type", "button"); on("click", "increment"); text("Count: $count"); end();
  end();
}
open APP, ">ui:#app";
mount(APP, "view");
`);

  const main = root.childNodes[0];
  const button = main.childNodes[1];
  assert.equal(root.textContent, "Perl CounterCount: 0");
  assert.equal(button.listenerCount("click"), 1);

  button.emit("click");
  assert.equal(root.textContent, "Perl CounterCount: 1");
  assert.equal(root.childNodes[0], main);
  assert.equal(main.childNodes[1], button);
  assert.equal(button.listenerCount("click"), 1);
  runtime.dispose();
  assert.equal(button.listenerCount("click"), 0);
});

test("rolls back Perl state and DOM when a candidate render fails", () => {
  const errors = [];
  const { root, runtime } = createUI(`
$count = 0;
$broken = 0;
sub break_view { $count++; $broken = 1; }
sub view {
  begin("button"); on("click", "break_view"); text("Count: $count"); end();
  if ($broken) { begin("script"); end(); }
}
open APP, ">ui:#app";
mount(APP, "view");
`, error => errors.push(error));

  const button = root.childNodes[0];
  button.emit("click");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Unsafe or invalid UI tag script/);
  assert.deepEqual(errors[0].uiStack, ["view"]);
  assert.equal(runtime.scalars.count, 0);
  assert.equal(runtime.scalars.broken, 0);
  assert.equal(root.textContent, "Count: 0");
  assert.equal(button.listenerCount("click"), 1);
});

test("reports the named component stack for render errors", () => {
  assert.throws(() => createUI(`
sub broken_component { begin("script"); end(); }
sub view { do broken_component(); }
open APP, ">ui:#app"; mount(APP, "view");
`), error => {
    assert.deepEqual(error.uiStack, ["view", "broken_component"]);
    assert.match(error.excerpt, /begin\("script"\)/);
    return true;
  });
});

test("binds form values and preserves keyed element identity", () => {
  const { root } = createUI(`
$draft = "";
@items = ("alpha", "beta");
sub add { push(@items, $draft); $draft = ""; }
sub swap { $temp = $items[0]; $items[0] = $items[1]; $items[1] = $temp; }
sub view {
  begin("input"); bind("value", "draft"); end();
  begin("button"); on("click", "add"); text("Add"); end();
  begin("button"); on("click", "swap"); text("Swap"); end();
  begin("ul");
  $i = 0;
  while ($i <= $#items) {
    begin("li"); key($items[$i]); text($items[$i]); end();
    $i++;
  }
  end();
}
open APP, ">ui:#app";
mount(APP, "view");
`);

  const input = root.childNodes[0];
  const add = root.childNodes[1];
  const swap = root.childNodes[2];
  const list = root.childNodes[3];
  const alpha = list.childNodes[0];
  const beta = list.childNodes[1];

  input.value = "gamma";
  input.emit("input");
  assert.equal(root.childNodes[0], input);
  assert.equal(input.value, "gamma");
  add.emit("click");
  assert.equal(input.value, "");
  assert.equal(list.textContent, "alphabetagamma");

  swap.emit("click");
  assert.equal(list.textContent, "betaalphagamma");
  assert.equal(list.childNodes[0], beta);
  assert.equal(list.childNodes[1], alpha);
});

test("batches a binding and same-event handler into one transaction", () => {
  const { root, runtime } = createUI(`
$draft = ""; $calls = 0; $seen = "";
sub changed { $calls++; $seen = $draft; }
sub view {
  begin("input"); bind("value", "draft"); on("input", "changed"); end();
  begin("output"); text("$calls:$seen"); end();
}
open APP, ">ui:#app"; mount(APP, "view");
`);
  const input = root.childNodes[0];
  input.value = "one event";
  input.emit("input");
  assert.equal(root.textContent, "1:one event");
  assert.equal(runtime.scalars.calls, 1);
  assert.equal(input.listenerCount("input"), 1);
});

test("rejects malformed trees, duplicate keys, and UI calls outside render", () => {
  assert.throws(() => createUI(`begin("div");`), /begin can only be called while rendering UI/);
  assert.throws(() => new Runtime().run(`sub view { begin("p"); end(); } open APP, "memory"; mount(APP, "view");`), error => {
    assert.equal(error.name, "PerlScriptRuntimeError");
    assert.match(error.message, /UI handles require BrowserIO/);
    return true;
  });
  assert.throws(() => createUI(`
sub view { begin("div"); }
open APP, ">ui:#app"; mount(APP, "view");
`), /Unclosed UI element div/);
  assert.throws(() => createUI(`
sub view {
  begin("p"); key("same"); end();
  begin("p"); key("same"); end();
}
open APP, ">ui:#app"; mount(APP, "view");
`), /Duplicate UI key same/);
});
