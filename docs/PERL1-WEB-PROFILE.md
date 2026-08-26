# Perl 1 Web Profile 1.0

Status: release-candidate contract

`perlscript-web` implements a deliberately bounded language profile inspired by Perl 1.0. It is not a complete build of the historical Perl 1.0 interpreter. The profile keeps the language side small and converts browser capabilities into filehandle-shaped I/O.

The compatibility promise for `perlscript-web` 1.x is this document. Additions are backward-compatible. Removing syntax, changing observable value semantics, or changing an existing filehandle contract requires a new major release.

## Source and execution

- Source is Unicode JavaScript text with CRLF/CR normalized to LF for parsing and diagnostics.
- Statements end with `;`; blocks use `{ ... }`.
- All variables are runtime-global except the dynamically scoped `@_` argument array during a subroutine call.
- Subroutines are registered before top-level statements execute, so calls may precede definitions.
- A page-authored Perl program has the same trust level as page-authored JavaScript. This runtime is not a sandbox.

## Values

- Scalars contain strings, numbers, or Perl booleans.
- Perl true is `1`; Perl false is the empty string.
- The empty string, numeric zero, string `"0"`, null-like absence, and false are false. Other strings and non-zero numbers are true.
- Arrays are ordered JavaScript-backed sequences.
- Hashes map string keys to scalar or aggregate values and preserve JavaScript property insertion order for `keys` and `values`.
- Double-quoted strings interpolate simple `$name` scalars. `\$` suppresses interpolation.
- Single-quoted strings do not interpolate and only treat `\\` and `\'` specially.

## Grammar profile

The notation is descriptive EBNF, not the parser implementation.

```text
program       = statement* EOF
statement     = sub | if | unless | while | return | open | select | print
              | expression [modifier] ";"
modifier      = ("if" | "unless") expression
sub           = "sub" IDENT block
if            = "if" "(" expression ")" block ["else" block]
unless        = "unless" "(" expression ")" block ["else" block]
while         = "while" "(" expression ")" block
return        = "return" [expression] [modifier] ";"
open          = "open" HANDLE "," expression ";"
select        = "select" HANDLE ";"
print         = "print" [HANDLE] [expression ("," expression)*] [modifier] ";"
block         = "{" statement* "}"
expression    = assignment | logical | comparison | concat | arithmetic
assignment    = assignable "=" expression
assignable    = variable | array-index | hash-index
array-index   = "$" IDENT "[" expression "]"
hash-index    = "$" IDENT "{" expression "}"
list          = "(" [expression ("," expression)*] ")"
call          = ["do"] IDENT "(" [expression ("," expression)*] ")"
read          = "<" HANDLE ">"
```

Supported variables are `$scalar`, `@array`, `%hash`, `$array[index]`, `$hash{key}`, and `$#array`.

Supported operators, from lower to higher precedence:

1. `||`
2. `&&`
3. `eq ne lt le gt ge == != < <= > >= =~ !~`
4. `.`
5. `+ -`
6. `* /`
7. unary `! -`
8. postfix `++ --`

Binary operators at the same level associate left. Assignment associates right.

## Built-ins

- `push(@array, value)`
- `pop(@array)`
- `shift(@array)`
- `keys(%hash)`
- `values(%hash)`
- `clear()` — browser extension; clears the selected output filehandle
- `watch(HANDLE, "sub")` — browser extension; invokes the named subroutine for events

User subroutine arguments are available as `@_` and through `$_[index]`, for example `$_[0]`. Nested calls restore the caller's `@_`.

## Regular expressions

- Match and negative match use `=~` and `!~` with `/pattern/flags`.
- Supported flags are `gimsuy`, matching JavaScript `RegExp` support.
- Simple scalar interpolation is applied to the pattern at evaluation time.
- Invalid dynamic patterns produce a structured runtime error. Browser runtimes with an error handler report the error without removing event listeners.
- Substitution, transliteration, captures, and Perl-specific regex constructs are outside Profile 1.0.

## Browser filehandles

```text
dom:<css-selector>                 readable element value/text
>dom:<css-selector>                writable text output
event:<event-name>:<css-selector>  event source
```

- CSS selectors are passed unchanged to `querySelector`; only the first match is used.
- A readable handle reads `value` when the element exposes it, otherwise `textContent`.
- Writing to a readable form handle replaces its value/text. This supports clearing an input with `print MESSAGE ""`.
- A writable handle appends text nodes. HTML is never interpreted.
- `clear()` clears the currently selected DOM or memory output.
- `keydown` event handles fire only for Enter and ignore IME composition (`isComposing` and key code 229).
- Other event handles fire for every event of their declared type.
- A runtime owns its listeners and removes them on `dispose()`.

## Browser API

- `run(source, options?)` executes synchronously and returns a `Runtime`.
- `runScripts(document?, options?)` loads inline and external `script[type="text/perl"]` elements in document order.
- `disposeScript(script)` cancels pending work and removes the active runtime for one script.
- `setErrorHandler(handler)` sets the default handler for top-level browser and event errors; pass `null` to clear it.
- `options.onError` overrides the default handler for one run.
- Re-execution is transactional: a failed replacement leaves the last good runtime active.
- Overlapping external loads are generation-guarded; only the newest requested runtime becomes active.

Errors are `PerlScriptSyntaxError` or `PerlScriptRuntimeError` with `range`, `excerpt`, line/column in the message, and `cause` where applicable.

## Resource limits and trust

- Each `while` statement is limited by `maxIterations` (default 100,000).
- Profile 1.0 does not promise isolation from recursion, memory growth, expensive regular expressions, or excessive output.
- Do not run untrusted Perl source. Applications accepting user-provided regex patterns should present runtime errors and may impose their own input policy.

## Intentionally unsupported in Profile 1.0

- Complete historical Perl 1.0 grammar or standard library
- Packages, modules, `require`, and filesystem/process access
- `eval`, formats, system calls, signals, and file-test operators
- `for`/`foreach`, `last`, `next`, and `redo`
- `local` beyond dynamic `@_`
- Regex substitution/transliteration and capture variables
- Perl context-sensitive scalar/list coercion beyond the operations defined here
- Direct DOM objects or browser event objects in Perl

Unsupported syntax must fail with a structured syntax or runtime error; it must not be accepted with silently different semantics.
