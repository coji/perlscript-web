# perlscript-web

**The future of UI, written in 1987.**

`perlscript-web` is a browser runtime and reactive UI layer built from a deliberately small, Perl 1.0-shaped language. The syntax stays in 1987; rendering, state scheduling, keyed reconciliation, lifecycle, and transactional recovery live in the 2026 runtime.

**Perl 1.0 syntax. 2026 runtime.**

```html
<script src="https://cdn.jsdelivr.net/npm/perlscript-web/dist/perlscript-web.min.js"></script>

<div id="app"></div>
<script type="text/perl">
$count = 0;

sub increment { $count++; }

sub view {
    begin("button", "type", "button");
    on("click", "increment");
    text("Count: $count");
    end();
}

open APP, ">ui:#app";
mount(APP, "view");
</script>
```

State is an ordinary Perl scalar. Views and handlers are named subroutines. Changing the scalar schedules one safe DOM update; no DOM query, HTML string, JavaScript callback, JSX, object system, or new Perl syntax is involved.

This is not a revival of ActiveState PerlScript and not a Perl-flavoured React port. It is a browser-only interpreter, structured UI runtime, and I/O bridge, installable from npm and usable from a CDN.

Try the live [perlscript-web workbench](https://coji.github.io/perlscript-web/) or open the [editable BBS directly](https://coji.github.io/perlscript-web/examples/bbs.html).

## PerlUI

PerlUI turns ordinary calls into a validated UI instruction tree:

- `open APP, ">ui:#app"` owns a mount point.
- `mount(APP, "view")` renders a named view subroutine.
- `begin`, `text`, and `end` describe structured, text-safe elements.
- `on("click", "handler", $argument)` invokes a named subroutine with captured `@_` arguments.
- `bind("value", "name")` connects a form property to `$name`.
- `key($id)` preserves element identity across list changes.

Assignments and array mutations are batched until the current top-level action finishes. Event and render failures restore the previous Perl state and last good UI. Nested subroutines are components and errors include their UI call stack.

See the normative [PerlUI 1.0 Profile](docs/PERLUI-1.0.md), the standalone [Counter](examples/counter.html) and [Todo](examples/todo.html), and the editable [Guestbook](examples/bbs.html).

## Low-level browser filehandles

The original browser-as-UNIX API remains available as the low-level compatibility layer. DOM values, text output, and browser events become filehandles rather than DOM objects:

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

`watch(HANDLE, "sub")`, `clear()`, and the PerlUI primitives are intentional browser extensions. Everything else follows the versioned [Perl 1 Web Profile 1.0](docs/PERL1-WEB-PROFILE.md).

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

Stable version `1.0.0` implements the documented **Perl 1 Web Profile 1.0** and **PerlUI 1.0 Profile**, not modern Perl and not full historical compatibility. See [compatibility](docs/COMPATIBILITY.md), [changelog](CHANGELOG.md), and [release procedure](docs/RELEASING.md).

## License

MIT
