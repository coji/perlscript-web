# Plan 002: Correct Perl value, literal, and expression semantics

> **Executor instructions**: Implement only the contract named here. Convert the corresponding TODO tests from Plan 001 into ordinary passing tests. Do not expand the documented language subset.
>
> **Drift check (run first)**: `shasum src/lexer.js src/parser.js src/runtime.js test/conformance.test.js`
> If Plan 001 is not DONE or the listed symbols have changed materially, STOP.

## Status

- **Execution**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-conformance-matrix.md`
- **Category**: bug
- **Planned at**: unversioned workspace snapshot, 2026-08-26

## Why this matters

The runtime currently uses JavaScript booleans and JavaScript truthiness. This makes Perl's false string `"0"` true and prints comparisons as `true`/`false` instead of `1`/empty string. The lexer also accepts malformed numbers and loses the distinction needed for correct single/double-quoted escaping.

## Current state

- `src/runtime.js:5`: `truthy` does not treat string `"0"` as false.
- `src/runtime.js:61,87-90`: unary, comparisons, and regex matches return JS booleans.
- `src/lexer.js:38-40`: both quote styles share one escape path and unknown escapes lose their backslash.
- `src/lexer.js:46-50`: `readNumber` consumes any number of dots and can emit `NaN`.
- `src/parser.js:66-81`: postfix updates are attached after the complete binary expression, so `$i++ + 1` fails.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Tests | `npm test` | all Plan 001 semantic TODOs converted and passing |
| Coverage | `node --test --experimental-test-coverage` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**: `src/lexer.js`, `src/parser.js`, `src/runtime.js`, `test/conformance.test.js`, and narrowly related existing parser/runtime tests.

**Out of scope**: new Perl syntax, hashes, browser lifecycle, I/O selector parsing, TypeScript migration, dist hand-edits.

## Steps

1. Introduce explicit Perl value helpers in `runtime.js`: false iff undefined/null, numeric zero, empty string, or exact string `"0"`; comparison/not/match results must be numeric `1` for true and empty string for false. Preserve operand-returning behavior for `||` and `&&`.
   - Verify exact output: `print 1 == 1, ":", 1 == 2, ":", !0;` → `1::1`.
2. Make number lexing validate one optional decimal point with digits on the supported sides. Reject `1.2.3` at the second dot with a `SyntaxError`; do not silently emit `NaN`.
3. Preserve quote-aware escape semantics. Single quotes only special-case escaped quote and backslash. Double quotes support the documented control escapes and must preserve escaped `$` so interpolation can distinguish it. Add cases for literal backslashes and dollars.
4. Move postfix parsing into a higher-precedence stage between primary expressions and unary/binary parsing. Support the already documented postfix `++`/`--` in larger expressions without adding prefix increment.
5. Convert the six related Plan 001 TODOs to passing tests and add left-associativity checks for subtraction plus precedence checks for concatenation/arithmetic/comparison.

## Done criteria

- [ ] `npm test` and `npm run build` exit 0.
- [ ] Exact falsehood and boolean output matches Perl conventions.
- [ ] Malformed numbers throw instead of producing `NaN`.
- [ ] Escaped dollars do not interpolate; ordinary dollars still do.
- [ ] `$i++ + 1` parses and has postfix semantics.
- [ ] No syntax outside the README subset is added.

## STOP conditions

- The desired Perl 1.0 behavior is ambiguous for a case not named here; verify against the historical manual before choosing.
- Correct escaping requires changing the public AST without source-span work from Plan 006; retain minimal token metadata instead of preempting Plan 006.
- The BBS regression test changes output.

## Maintenance notes

Do not allow JS boolean values to re-enter user-visible runtime state. Future builtins must return Perl-shaped values.
