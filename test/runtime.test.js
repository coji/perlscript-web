import test from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../src/runtime.js";
import { MemoryIO } from "../src/io.js";

test("runs arrays, subs, loops, interpolation, regex, and output", () => {
  const io = new MemoryIO();
  const runtime = new Runtime({ io });
  runtime.run(`
    @items = ();
    push(@items, "perl");
    push(@items, "web");
    sub render {
      $i = 0;
      while ($i <= $#items) {
        $item = $items[$i];
        print "$i:$item\\n" if $item =~ /perl|yapc/i;
        $i++;
      }
    }
    do render();
  `);
  assert.equal(io.read("STDOUT"), "0:perl\n");
});

test("supports explicit and selected handles", () => {
  const io = new MemoryIO();
  new Runtime({ io }).run(`
    open LEFT, ">dom:#left";
    open RIGHT, ">dom:#right";
    select LEFT;
    print "a";
    print RIGHT "b";
    do clear();
    print "c";
  `);
  assert.equal(io.read("LEFT"), "c");
  assert.equal(io.read("RIGHT"), "b");
});
