# Plan 001: Establish a Perl-subset conformance matrix

> **Executor instructions**: Follow every step and verification gate. Do not change runtime behavior in this plan. Mark currently unsupported or incorrect promised behavior with `test.todo`, including an explanation, so the suite remains green. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `shasum src/lexer.js src/parser.js src/runtime.js src/browser.js test/*.test.js`
> Compare the live structure with the excerpts below. This workspace has no Git metadata; if the named symbols or current tests no longer match, STOP and report drift.

## Status

- **Execution**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: unversioned workspace snapshot, 2026-08-26

## Why this matters

The suite reports 97.69% line coverage, but boundary probes still show incorrect Perl behavior. `src/browser.js` is not loaded by any test and therefore does not appear in coverage. A table-driven contract must separate supported Perl 1.0 behavior, deliberate browser extensions, and known gaps before implementation changes begin.

## Current state

- `test/parser.test.js:5-23` has one BBS-shaped parse test and one unterminated-string test.
- `test/runtime.test.js:6-39` has two broad happy-path tests.
- `test/browser.test.js:6-15` defines a fake element whose `Map` stores only one listener per event, unlike the DOM.
- `src/browser.js:14-31` implements `runScripts` and `disposeScript`, but no test imports this module.
- Existing convention: tests use `node:test` and `node:assert/strict`; preserve it.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Baseline | `npm test` | 7 tests pass |
| Coverage | `node --test --experimental-test-coverage` | exit 0; `browser.js` appears after this plan |
| Build | `npm run build` | both dist bundles build |

## Scope

**In scope**: `test/helpers/fake-dom.js` (create), `test/conformance.test.js` (create), `test/browser.test.js`, `test/bbs.test.js`, `test/parser.test.js`, `test/runtime.test.js`.

**Out of scope**: all `src/`, `dist/`, examples, dependencies, and package scripts.

## Steps

1. Create `test/helpers/fake-dom.js`. Model real DOM listener behavior with `Map<string, Set<Function>>`; provide `addEventListener`, `removeEventListener`, `emit`, `listenerCount`, `value`, and `textContent`. Provide a fixture factory that records selectors passed to `querySelector`.
   - Verify: `npm test` → existing tests still pass after migrating both browser-related tests to this helper.
2. Add `test/conformance.test.js` with table-driven sections for literals, truthiness, comparison results, interpolation/escaping, precedence/associativity, arrays, modifiers, regex, filehandles, syntax errors, and loop limits.
   - Passing cases must assert exact STDOUT or exact AST shape.
   - Add TODO cases for: string `"0"` falsehood; Perl `1`/empty-string boolean results; malformed `1.2.3`; escaped dollar; single-quoted backslashes; `$i++ + 1`.
   - Verify: `npm test` → pass with the known gaps explicitly reported as TODO, not silently skipped.
3. Add `test/browser-api.test.js` importing `run`, `runScripts`, and `disposeScript`. Cover inline scripts, document order, external `src` via a restored-in-`finally` fetch stub, disposal, missing selectors, HTTP failure, parse failure, and repeat execution.
   - Characterize current failed-rerun teardown and startup leak as TODO tests; plan 003 will make them pass.
   - Verify: coverage command → `browser.js` appears and all non-TODO tests pass.

## Done criteria

- [ ] `npm test` exits 0 and reports the named TODO cases.
- [ ] `browser.js` appears in coverage.
- [ ] One shared fake DOM helper supports multiple listeners per event.
- [ ] No `src/`, `dist/`, example, manifest, or lockfile changes.

## STOP conditions

- Existing behavior differs from the audit probes before new tests are added.
- Testing `browser.js` requires a real browser or a new dependency; use injected fakes instead and report if injection is impossible.
- A proposed contract cannot be tied to the README subset or the supplied BBS requirements.

## Maintenance notes

Every newly supported syntax form should enter the conformance table before implementation. Line coverage is secondary to semantic cases.
