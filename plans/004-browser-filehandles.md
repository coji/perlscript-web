# Plan 004: Make browser filehandles selector-safe and scalable

> **Executor instructions**: Correct the filehandle spec parser without changing the documented `dom:` and `event:` forms. Improve output writes only if exact `print` ordering remains observable.
>
> **Drift check (run first)**: `shasum src/browser-io.js src/io.js test/browser.test.js test/conformance.test.js`

## Status

- **Execution**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/001-conformance-matrix.md`
- **Category**: bug, performance
- **Planned at**: unversioned workspace snapshot, 2026-08-26

## Why this matters

The current regex parses `dom:input:checked` as selector `input`, silently targeting the wrong element. Output also reads and replaces full `textContent` on every `print`, producing repeated DOM work and quadratic copying for long render loops.

## Current state

- `src/browser-io.js:7-15` uses one regex for DOM and event specs, but ignores `selectorTail` for DOM handles.
- `src/browser-io.js:27` assigns `element.textContent = old + value` per write.
- `src/browser-io.js:37-46` accepts arbitrary event names and correctly tracks removal callbacks.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| I/O tests | `node --test test/browser.test.js test/conformance.test.js` | all pass |
| Full suite | `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**: `src/browser-io.js`, narrowly `src/io.js` if a write abstraction is required, `test/browser.test.js`, `test/conformance.test.js`, `test/helpers/fake-dom.js`.

**Out of scope**: richer DOM APIs, HTML output, event objects in Perl, parser/runtime grammar, example-specific rendering.

## Steps

1. Replace the shared regex split with prefix-specific parsing: after `dom:` the entire remainder is the selector; after `event:` split only at the first colon into non-empty event name and non-empty full selector remainder. Preserve the optional leading `>` only for DOM output.
2. Reject malformed specs that begin with `dom:` or `event:` using descriptive errors instead of falling back to memory handles. Preserve fallback only for genuinely non-browser specs.
3. Add exact-selector tests for pseudo-classes, attribute values containing colons, and event selectors containing colons. Add malformed event tests.
4. Avoid whole-string read/replace when the real DOM provides `append`; append a text node or equivalent text safely. Keep a compatibility fallback for the fake DOM and DOM-like embedders. Do not use `innerHTML`.
5. Add a many-write test asserting exact order and that the append-capable path is used; do not add timing-based assertions.

## Done criteria

- [ ] `dom:input:checked` passes exactly `input:checked` to `querySelector`.
- [ ] `event:click:.item[data-id="a:b"]` preserves the complete selector.
- [ ] Malformed browser specs throw descriptive errors.
- [ ] Output remains text-only and ordered.
- [ ] Tests and build pass.

## STOP conditions

- A proposed buffering scheme delays output across an event turn or changes when DOM text becomes visible; use immediate safe append instead.
- Supporting a selector requires escaping or rewriting it; selectors must be passed through unchanged.

## Maintenance notes

The filehandle grammar should remain smaller than CSS/event grammar: parse only the fixed prefix and first event separator, never attempt to parse CSS itself.
