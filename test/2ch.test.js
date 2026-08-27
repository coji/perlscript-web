import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

test("the 2ch archive demo keeps routing, persistence, clock, and posting in Perl", async () => {
  const html = await readFile(new URL("../examples/2ch.html", import.meta.url), "utf8");
  const source = html.match(/<script id="app"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source);
  assert.match(source, /open ROUTE, "route:hash"/);
  assert.match(source, /open CLOCK, "clock:60000"/);
  assert.match(source, /storage:local:perlscript-web\/2ch\/threads-v3/);
  assert.match(source, /open STYLE, ">css:2ch-archive"/);

  const root = new FakeElement();
  const stored = new Map();
  const local = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
  let route = "/php/";
  const listeners = new Map();
  const navigation = {
    location: { hash: `#${route}`, pathname: "/examples/2ch.html", search: "" },
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
  assert.match(root.textContent, /WEBプログラミング＠PerlUI掲示板/);
  assert.match(root.textContent, /ブラウザでPerlを動かすスレ/);
  assert.match(root.textContent, /localStorageをファイルとして使う/);
  assert.match(root.textContent, /新規スレッド作成画面へ/);
  assert.doesNotMatch(root.textContent, /題名：/);
  assert.deepEqual(runtime.arrays.threads.filter(thread => thread.board === "php").map(thread => thread.posts.length), [6, 5, 5, 4, 5]);
  assert.deepEqual([...new Set(runtime.arrays.threads.map(thread => thread.board))], ["php", "prog", "unix", "hp", "hosting"]);
  assert.equal(new Set(runtime.arrays.threads.map(thread => thread.posts[0].body)).size, 13);

  runtime.scalars.route = "/test/new.cgi/php/";
  runtime.scalars.subject = "Perl 1.0でUIを作るスレ";
  runtime.scalars.message = "routerもstorageもfilehandleだった。";
  runtime.call("create_thread", []);
  runtime.flushUI();
  assert.equal(navigation.location.hash, "#/test/read.cgi/php/1787760000/");
  const threads = JSON.parse(stored.get("perlscript-web/2ch/threads-v3"));
  assert.equal(threads.at(-1).board, "php");
  assert.equal(threads.at(-1).title, "Perl 1.0でUIを作るスレ");
  assert.equal(threads.at(-1).posts[0].body, "routerもstorageもfilehandleだった。");
  runtime.dispose();
});
