import test from "node:test";
import assert from "node:assert/strict";
import { DOMUIRenderer, UITreeBuilder } from "../src/ui.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

function keyedList(keys) {
  const builder = new UITreeBuilder();
  builder.begin("ul", []);
  for (const value of keys) {
    builder.begin("li", []);
    builder.key(value);
    builder.text(value);
    builder.end();
  }
  builder.end();
  return builder.finish();
}

test("reordering 100 keyed rows reuses every compatible element", () => {
  const root = new FakeElement();
  const state = createFakeDocument();
  const renderer = new DOMUIRenderer(state.document, root);
  const keys = Array.from({ length: 100 }, (_, index) => `row-${index}`);
  renderer.commit(keyedList(keys), () => {});
  const list = root.childNodes[0];
  const identities = new Map(list.childNodes.map(node => [node.textContent, node]));
  assert.equal(state.createdElements.length, 101);

  renderer.commit(keyedList([...keys].reverse()), () => {});
  assert.equal(state.createdElements.length, 101);
  assert.deepEqual(list.childNodes.map(node => node.textContent), [...keys].reverse());
  for (const node of list.childNodes) assert.equal(node, identities.get(node.textContent));
});

