import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

test("the mixi archive keeps navigation, diaries, footprints, communities, and clock in Perl", async () => {
  const html = await readFile(new URL("../examples/mixi.html", import.meta.url), "utf8");
  const source = html.match(/<script id="app"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source);
  assert.match(source, /open ROUTE, "route:hash"/);
  assert.match(source, /open CLOCK, "clock:60000"/);
  assert.match(source, /storage:local:perlscript-web\/mixi\/diaries-v2/);
  assert.match(source, /storage:local:perlscript-web\/mixi\/footprints-v1/);
  assert.match(source, /storage:local:perlscript-web\/mixi\/communities-v1/);
  assert.match(source, /open STYLE, ">css:mixi-2005"/);

  const root = new FakeElement();
  const stored = new Map();
  const local = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
  let route = "/home.pl";
  const listeners = new Map();
  const navigation = {
    location: { hash: `#${route}`, pathname: "/examples/mixi.html", search: "" },
    history: { pushState(_state, _title, value) { route = value; navigation.location.pathname = value; } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const document = createFakeDocument({ "#app-root": root }).document;
  const runtime = new Runtime({ io: new BrowserIO(document, {
    storage: { local },
    clock: { now: () => 1787760000000, setInterval: () => 1, clearInterval() {} },
    navigation,
  }) });

  runtime.run(source);
  assert.match(root.textContent, /マイミクシィ最新日記/);
  assert.match(root.textContent, /ブラウザでPerlが動いた/);
  assert.equal(runtime.arrays.users.length, 9);
  assert.equal(runtime.arrays.diaries.length, 9);
  assert.equal(runtime.arrays.communities.length, 2);
  assert.match(root.textContent, /Dan Kogai/);
  assert.match(root.textContent, /miyagawa/);
  assert.match(root.textContent, /naoya/);
  assert.match(root.textContent, /lestrrat/);

  runtime.scalars.route = "/add_diary.pl";
  runtime.scalars.diary_title = "Perlで書いた日記";
  runtime.scalars.diary_body = "routeもstorageも普通のfilehandleだった。";
  runtime.call("create_diary", []);
  runtime.flushUI();
  assert.equal(navigation.location.hash, "#/view_diary.pl?id=1787760000&owner_id=1");
  const diaries = JSON.parse(stored.get("perlscript-web/mixi/diaries-v2"));
  assert.equal(diaries.at(-1).title, "Perlで書いた日記");
  assert.equal(diaries.at(-1).owner, "1");

  runtime.scalars.view_user = "2";
  runtime.call("record_footprint", []);
  const footprints = JSON.parse(stored.get("perlscript-web/mixi/footprints-v1"));
  assert.deepEqual({ owner: footprints.at(-1).owner, user: footprints.at(-1).user }, { owner: "2", user: "1" });
  runtime.dispose();
});
