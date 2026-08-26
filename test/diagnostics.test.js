import test from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { Runtime } from "../src/runtime.js";
import { PerlScriptSyntaxError, PerlScriptRuntimeError } from "../src/errors.js";

test("tokens carry normalized one-based source positions", () => {
  const tokens = tokenize("# heading\r\nprint 12;");
  assert.deepEqual(tokens[0].range, {
    start: { offset: 10, line: 2, column: 1 },
    end: { offset: 15, line: 2, column: 6 },
  });
  assert.deepEqual(tokens.at(-1).range.start, { offset: 19, line: 2, column: 10 });
});

test("syntax errors expose range, line, column, and excerpt", () => {
  assert.throws(
    () => parse("$x = 1;\nprint $x"),
    error => {
      assert.ok(error instanceof PerlScriptSyntaxError);
      assert.match(error.message, /Expected ;, got EOF at 2:9/);
      assert.equal(error.range.start.line, 2);
      assert.equal(error.range.start.column, 9);
      assert.equal(error.excerpt, "print $x\n        ^");
      return true;
    },
  );
});

test("runtime errors preserve the source range and original cause", () => {
  assert.throws(
    () => new Runtime().run("$x = 1;\ndo missing();"),
    error => {
      assert.ok(error instanceof PerlScriptRuntimeError);
      assert.match(error.message, /Undefined subroutine missing at 2:1/);
      assert.equal(error.range.start.line, 2);
      assert.equal(error.range.start.column, 1);
      assert.ok(error.cause instanceof Error);
      assert.equal(error.cause.message, "Undefined subroutine missing");
      return true;
    },
  );
});

test("every AST node carries a valid source range", () => {
  const program = parse(`
    @items = ();
    sub add { push(@items, "x"); }
    if ($#items < 1) { do add(); }
  `);
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (typeof value.type === "string") {
      assert.ok(value.range, `${value.type} has a range`);
      assert.ok(value.range.start.offset <= value.range.end.offset, `${value.type} range is ordered`);
    }
    for (const child of Object.values(value)) {
      if (child !== value.range) Array.isArray(child) ? child.forEach(visit) : visit(child);
    }
  };
  visit(program);
});
