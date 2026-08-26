import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as api from "perlscript-web";

test("the ESM package boundary exposes core and browser APIs without a document", () => {
  for (const name of [
    "Lexer", "Parser", "Runtime", "MemoryIO", "BrowserIO", "UITreeBuilder", "DOMUIRenderer",
    "tokenize", "parse", "run", "runScripts", "disposeScript", "setErrorHandler",
    "PerlScriptSyntaxError", "PerlScriptRuntimeError",
  ]) assert.equal(typeof api[name], "function", `${name} must be exported`);
});

test("the IIFE bundle exposes only the documented browser lifecycle API", async () => {
  const source = await readFile(new URL("../dist/perlscript-web.js", import.meta.url), "utf8");
  const context = {};
  vm.runInNewContext(source, context);
  assert.deepEqual(Object.keys(context.PerlScript).sort(), ["disposeScript", "run", "runScripts", "setErrorHandler"]);
});
