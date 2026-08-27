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

test("exposes regex captures for route dispatch", () => {
  const io = new MemoryIO();
  new Runtime({ io }).run(`
    $path = "/test/read.cgi/perl/1234567890";
    if ($path =~ /^\\/test\\/read\\.cgi\\/([A-Za-z0-9_]+)\\/([0-9]+)$/) {
      print "$1:$2";
    }
  `);
  assert.equal(io.read("STDOUT"), "perl:1234567890");
});

test("rejects capture variables beyond $1 through $9 consistently", () => {
  assert.throws(() => new Runtime().run('$10 = "direct";'), /Capture variables are limited to \$1 through \$9/);
  assert.throws(() => new Runtime().run('print "$10";'), /Capture variables are limited to \$1 through \$9/);
  const io = new MemoryIO();
  new Runtime({ io }).run('$1 = "supported"; print "$1";');
  assert.equal(io.read("STDOUT"), "supported");
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

test("exposes redacted runtime state and metadata-only observation events", () => {
  const runtime = new Runtime();
  const observed = [];
  runtime.subscribe(event => observed.push(event));
  runtime.run(`
    $count = 1;
    $api_key = "must-not-leak";
    %request = ("authorization", "must-not-leak", "safe", "shown");
    sub increment { $count++; }
    do increment();
    open OUT, ">memory";
    print OUT "private payload";
  `);
  const inspection = runtime.inspect();
  assert.equal(inspection.scalars.count, 2);
  assert.equal(inspection.scalars.api_key, "[redacted]");
  assert.equal(inspection.hashes.request.authorization, "[redacted]");
  assert.equal(inspection.hashes.request.safe, "shown");
  assert.equal(inspection.lastSub, "increment");
  assert.ok(observed.some(event => event.action === "call" && event.sub === "increment"));
  assert.ok(observed.some(event => event.action === "write" && event.handle === "OUT" && event.bytes === 15));
  assert.doesNotMatch(JSON.stringify(inspection.events), /private payload|must-not-leak/);
});

test("encodes and decodes JSON values for browser I/O protocols", () => {
  const io = new MemoryIO();
  new Runtime({ io }).run(`
    %reasoning = ("effort", "none");
    %request = ("model", "gpt-5.6-luna", "stream", json_boolean(1), "reasoning", %reasoning);
    $wire = encode_json(%request);
    %event = decode_json('{"type":"response.completed","response":{"id":"resp_1"}}');
    print $wire, "\n", $event{type}, "\n", json_get(%event, "response", "id");
  `);
  assert.equal(io.read("STDOUT"), '{"model":"gpt-5.6-luna","stream":true,"reasoning":{"effort":"none"}}\nresponse.completed\nresp_1');
});
