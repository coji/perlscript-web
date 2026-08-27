import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Runtime } from "../src/runtime.js";
import { BrowserIO } from "../src/browser-io.js";
import { FakeElement, createFakeDocument } from "./helpers/fake-dom.js";

test("PerlGPT owns its API request, settings, and streamed event handling in Perl", async () => {
  const html = await readFile(new URL("../examples/perlgpt.html", import.meta.url), "utf8");
  assert.match(html, /class="ui-icon icon-close"/);
  assert.match(html, /cdn\.jsdelivr\.net\/npm\/ace-builds\/src-min-noconflict/);
  assert.match(html, /mode: 'ace\/mode\/perl'/);
  assert.match(html, /id="source-editor"/);
  assert.match(html, /aria-label="Perl runtime inspector"/);
  assert.match(html, /data-source-marker="sub connect_http"/);
  assert.match(html, /id="source" hidden aria-hidden="true"/);
  assert.match(html, /editor\.session\.on\('change', \(\) => \{ sourceBuffer\.value = editor\.getValue\(\); \}\)/);
  assert.doesNotMatch(html, /<script\s+src="[^"]*ace-builds/);
  assert.match(html, /open STYLE, ">css:perlgpt";/);
  assert.match(html, /print STYLE '\n\.settings-layer\{/);
  assert.match(html, /"class", "ui-icon icon-settings"/);
  assert.doesNotMatch(html, /text\("(?:＋|⌕|⚙|☰|◇|↑|■|×)"\)/);
  assert.match(html, /\.settings-field input\{[^}]*border:1px solid var\(--color-rule-strong\);[^}]*outline:2px solid transparent/);
  const source = html.match(/<script id="app"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source, "embedded Perl source must exist");
  assert.match(source, /"url", "https:\/\/api\.openai\.com\/v1\/responses"/);
  assert.match(source, /"model", \$api_model/);
  assert.match(source, /"reasoning", %reasoning/);
  assert.match(source, /if \(\$event_type eq "response\.output_text\.delta"\)/);
  assert.match(source, /sub save_settings/);
  assert.match(source, /open HISTORY, "storage:local:perlgpt\/chats"/);
  assert.match(source, /print HISTORY encode_json\(@chats\)/);
  assert.match(source, /sub open_saved_chat/);
  assert.match(html, /PerlScript\.installWebAdapters\(\)/);
  assert.doesNotMatch(html, /registerStream\('http'/);
  assert.doesNotMatch(html, /registerStream\('secret'/);
  assert.doesNotMatch(html, /registerStream\('chat'/);
  assert.doesNotMatch(html, /registerStream\('storage'/);

  const root = new FakeElement();
  const editor = new FakeElement("print \"hello\";");
  const { document } = createFakeDocument({ "#app-root": root, "#source": editor });
  const stored = new Map();
  const local = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
  const httpSinks = [];
  const requests = [];
  const io = new BrowserIO(document, { streams: {
    http(next) {
      httpSinks.push(next);
      return { write(value) { requests.push(JSON.parse(value)); }, close() {} };
    },
    secret(next) {
      return { write(value) {
        const command = JSON.parse(value);
        next.emit(JSON.stringify({ type: "secret.result", op: command.op, name: command.name, configured: true, persisted: false }));
        next.end();
      } };
    },
  }, storage: { local } });
  const runtime = new Runtime({ io });
  runtime.run(source);

  runtime.scalars.prompt = "filehandleとは？";
  runtime.call("send_review", []);
  runtime.flushUI();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
  assert.equal(requests[0].credential, "openai");
  assert.equal(requests[0].body.model, "gpt-5.6-luna");
  assert.equal(requests[0].body.reasoning.effort, "none");
  assert.equal(requests[0].body.stream, true);
  assert.match(requests[0].body.input, /filehandleとは？/);
  assert.match(requests[0].body.input, /print "hello";/);
  assert.equal(runtime.scalars.streaming, 1);

  httpSinks[0].emit(JSON.stringify({ type: "response.output_text.delta", delta: "ブラウザの" }));
  httpSinks[0].emit(JSON.stringify({ type: "response.output_text.delta", delta: "I/Oです。" }));
  assert.equal(runtime.scalars.answer, "ブラウザのI/Oです。");
  httpSinks[0].emit(JSON.stringify({ type: "response.completed", response: { id: "resp_1" } }));
  assert.equal(runtime.scalars.previous_response_id, "resp_1");
  httpSinks[0].end();
  assert.equal(runtime.scalars.streaming, 0);
  assert.match(root.textContent, /ブラウザのI\/Oです。/);
  const history = JSON.parse(stored.get("perlgpt/chats"));
  assert.deepEqual(history, [{
    id: 1,
    title: "filehandleとは？",
    question: "filehandleとは？",
    answer: "ブラウザのI/Oです。",
    response_id: "resp_1",
  }]);
  runtime.call("delete_saved_chat", [1]);
  runtime.flushUI();
  assert.deepEqual(JSON.parse(stored.get("perlgpt/chats")), []);
  assert.equal(runtime.scalars.has_answer, 0);
  assert.equal(runtime.scalars.current_chat_id, "");
  runtime.dispose();
});
