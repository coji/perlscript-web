import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../src/parser.js";

test("parses the core BBS-shaped program", () => {
  const tree = parse(`
    @messages = ();
    sub render {
      $i = 0;
      while ($i <= $#messages) {
        $line = $messages[$i];
        print POSTS $line, "\\n" if $line =~ /perl|yapc/i;
        $i++;
      }
    }
    do render();
  `);
  assert.equal(tree.type, "program");
  assert.equal(tree.body[1].type, "sub");
});

test("reports malformed source", () => {
  assert.throws(() => parse('print "unterminated;'), /Unterminated string/);
});

test("distinguishes grouped expressions, lists, and hash indexes", () => {
  const tree = parse('@a = (1, 2); $x = (1 + 2); $h{"key"} = 3;');
  assert.equal(tree.body[0].expression.right.type, "list");
  assert.equal(tree.body[1].expression.right.type, "binary");
  assert.equal(tree.body[2].expression.left.type, "hashIndex");
});
