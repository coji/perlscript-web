import test from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../src/runtime.js";
import { MemoryIO } from "../src/io.js";
import { parse } from "../src/parser.js";

function output(source) {
  const io = new MemoryIO();
  new Runtime({ io }).run(source);
  return io.read("STDOUT");
}

for (const { name, source, expected } of [
  { name: "arithmetic precedence", source: "print 2 + 3 * 4;", expected: "14" },
  { name: "left associative subtraction", source: "print 9 - 3 - 2;", expected: "4" },
  { name: "concat below arithmetic", source: "print \"x\" . 1 + 2;", expected: "x3" },
  { name: "short-circuit operands", source: "print \"left\" || \"right\", \"/\", \"\" || \"right\";", expected: "left/right" },
  { name: "single quotes do not interpolate", source: "$x = \"value\"; print '$x';", expected: "$x" },
  { name: "array operations", source: "@a = (); push(@a, \"a\"); push(@a, \"b\"); print shift(@a), pop(@a), $#a;", expected: "ab-1" },
  { name: "list expressions and array assignment", source: '@a = ("a", "b", 3); print @a;', expected: "ab3" },
  { name: "hash assignment and access", source: '%h = ("first", 1, "second", 2); $h{"third"} = 3; print $h{"first"}, $h{"third"};', expected: "13" },
  { name: "deterministic hash keys and values", source: '%h = ("first", 1, "second", 2); print keys(%h), ":", values(%h);', expected: "firstsecond:12" },
  { name: "subroutine arguments through @_", source: 'sub greet { return "hi " . $_[0]; } print greet("web");', expected: "hi web" },
  { name: "nested calls restore caller @_", source: 'sub inner { return $_[0]; } sub outer { $before = $_[0]; $x = inner("inside"); return $before . ":" . $_[0] . ":" . $x; } print outer("outside");', expected: "outside:outside:inside" },
  { name: "statement modifiers", source: "print \"yes\" if 1; print \"no\" unless 1;", expected: "yes" },
  { name: "regex match", source: "$x = \"Perl\"; print \"yes\" if $x =~ /perl/i;", expected: "yes" },
]) test(name, () => assert.equal(output(source), expected));

test("comparison precedence is represented in the AST", () => {
  const expression = parse("$x = 1 + 2 == 3;").body[0].expression;
  assert.equal(expression.type, "assign");
  assert.equal(expression.right.type, "binary");
  assert.equal(expression.right.op, "==");
  assert.equal(expression.right.left.op, "+");
});

test("loop limit stops runaway source", () => {
  assert.throws(() => new Runtime({ maxIterations: 3 }).run("while (1) {}"), /Maximum loop iterations/);
});

test("string zero is false in Perl", () => {
  assert.equal(output('print "wrong" if "0";'), "");
});

test("boolean results use Perl values", () => {
  assert.equal(output('print 1 == 1, ":", 1 == 2, ":", !0;'), "1::1");
});

test("malformed numbers are rejected", () => {
  assert.throws(() => parse("print 1.2.3;"), SyntaxError);
});

test("escaped dollars stay literal", () => {
  assert.equal(output('$name = "expanded"; print "\\$name";'), "$name");
});

test("single-quoted unknown escapes keep the backslash", () => {
  assert.equal(output("print '\\n';"), "\\n");
});

test("postfix update binds before addition", () => {
  assert.equal(output("$i = 1; print $i++ + 1, ':', $i;"), "2:2");
});

test("hash assignment rejects an odd key/value list", () => {
  assert.throws(() => output('%h = ("key", 1, "dangling");'), /even number of values/);
});
