import test from "node:test";
import assert from "node:assert/strict";
import { createImageAdapter } from "../src/image-adapter.js";

const invoke = (adapter, command) => new Promise(resolve => {
  const events = [];
  adapter({ emit: value => events.push(JSON.parse(value)), end: () => resolve(events) }).write(JSON.stringify(command));
});

test("image adapter returns a processed, storage-safe image record", async () => {
  const file = { name: "profile.png", type: "image/png", size: 2048 };
  const document = { querySelector: selector => selector === "#photo" ? { files: [file] } : null };
  let received;
  const adapter = createImageAdapter({ document, processImage: async (selected, command) => {
    received = { selected, command };
    return { data: "data:image/webp;base64,AAAA", width: 512, height: 512, bytes: 3, mime: "image/webp" };
  } });
  const events = await invoke(adapter, { id: "diary-1", selector: "#photo", size: 512, quality: 0.82 });
  assert.equal(received.selected, file);
  assert.equal(received.command.size, 512);
  assert.deepEqual(events, [{ type: "image.result", id: "diary-1", name: "profile.png", data: "data:image/webp;base64,AAAA", width: 512, height: 512, bytes: 3, mime: "image/webp" }]);
});

test("image adapter reports missing, unsupported, and oversized input", async () => {
  const element = { files: [] };
  const adapter = createImageAdapter({ document: { querySelector: () => element }, processImage: async () => assert.fail("must not process") });
  const missing = (await invoke(adapter, { id: "diary-3", selector: "#photo" }))[0];
  assert.equal(missing.id, "diary-3");
  assert.match(missing.message, /選択/);
  element.files = [{ name: "notes.txt", type: "text/plain", size: 20 }];
  assert.match((await invoke(adapter, { selector: "#photo" }))[0].message, /JPEG/);
  element.files = [{ name: "huge.png", type: "image/png", size: 100 }];
  assert.match((await invoke(adapter, { selector: "#photo", maxInputBytes: 50 }))[0].message, /大きすぎ/);
});
