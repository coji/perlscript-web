# perlscript-web

**Make the browser a UNIX that Perl 1.0 can understand.**

`perlscript-web` runs a deliberately small, Perl 1.0-shaped language in the browser. It does not expose the DOM to Perl. Instead, DOM elements and browser events become filehandles: read an input with `<MESSAGE>`, write to an element with `print`, and watch an event handle.

```html
<script src="https://cdn.jsdelivr.net/npm/perlscript-web/dist/perlscript-web.min.js"></script>

<output id="hello"></output>
<script type="text/perl">
open HELLO, ">dom:#hello";
select HELLO;
print "Hello from Perl.";
</script>
```

This is not a revival of ActiveState PerlScript. It is a browser-only interpreter and I/O bridge, installable from npm and usable from a CDN.

## Filehandles

```perl
open NAME,    "dom:#name";             # read value/text
open POSTS,   ">dom:#posts";           # write text
open POST,    "event:click:#post";      # click stream
open ENTER,   "event:keydown:#message"; # Enter stream

$name = <NAME>;
select POSTS;
print $name, "\n";
do watch(POST, "post");
do watch(ENTER, "post");
```

`keydown` event handles fire only for Enter and ignore IME composition (`isComposing` and key code 229). Output is written with `textContent`, so user input is not interpreted as HTML.

`watch(HANDLE, "sub")` and `clear()` are the two intentional browser-I/O extensions. Everything else follows the versioned [Perl 1 Web Profile 1.0](docs/PERL1-WEB-PROFILE.md).

## Supported subset

- Scalars, list expressions, arrays, hashes, strings, numbers, assignment and interpolation
- Array/hash indexing, `$#array`, `push`, `pop`, `shift`, `keys`, `values`
- Arithmetic, concatenation, string/numeric comparisons
- Regular expressions and `=~` / `!~`
- `if`, `unless`, statement modifiers, `while`, `return`
- `sub`, dynamic `@_` arguments, `do`, `open`, `select`, `print`, `<FILEHANDLE>`

The parser intentionally rejects unsupported modern Perl instead of silently pretending to implement Perl as a whole.

## Browser API

The IIFE bundle creates `window.PerlScript`:

```js
const runtime = PerlScript.run(source);
await PerlScript.runScripts();
PerlScript.setErrorHandler(error => console.error(error.message, error.excerpt));
runtime.dispose();
```

ES modules expose the same lifecycle API without automatically scanning the document:

```js
import { run, runScripts, setErrorHandler, Runtime, BrowserIO } from "perlscript-web";

const runtime = run(source);
```

`runScripts()` executes inline and external (`src="./app.pl"`) `text/perl` scripts in document order. A successful rerun atomically replaces the previous runtime; a failed rerun leaves it active. `setErrorHandler()` receives structured top-level and event errors. Pass `null` to clear the handler, or use `{ onError }` to override it for one run.

The source modules also export `Lexer`, `Parser`, `Runtime`, `MemoryIO`, and `BrowserIO` for tests and embedding.

Perl source executed by this package must be treated as page-authored code with the same trust level as JavaScript. The interpreter limits runaway `while` loops, but it is not a security sandbox for untrusted programs.

## Development

Requires Node.js 20 or newer and pnpm 11. The exact pnpm version is pinned by the `packageManager` field.

```sh
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
pnpm exec playwright install chromium firefox webkit
pnpm run test:e2e
```

`pnpm run check` runs the complete test suite, strict JSDoc type checking, and both distribution builds. Lexer tokens and AST nodes include source ranges; syntax and runtime errors expose `range`, `excerpt`, and line/column-aware messages.

Open `examples/bbs.html` through a local HTTP server to try the editable BBS demo:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/examples/bbs.html`.

## Project status

Version `1.0.0-rc.1` is a release candidate for YAPC::Tokyo 2026. The compatibility target is the documented **Perl 1 Web Profile 1.0**, not modern Perl and not full historical compatibility. See [compatibility](docs/COMPATIBILITY.md), [changelog](CHANGELOG.md), and [release procedure](docs/RELEASING.md).

## License

MIT
