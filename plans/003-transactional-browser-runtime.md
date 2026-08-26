# Plan 003: Make browser execution transactional and leak-free

> **Executor instructions**: Fix startup cleanup, failed-rerun rollback, and overlapping `runScripts` calls. Use the fake DOM and API tests from Plan 001. Do not redesign Perl event semantics.
>
> **Drift check (run first)**: `shasum src/browser.js src/browser-io.js test/browser-api.test.js test/helpers/fake-dom.js`

## Status

- **Execution**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-conformance-matrix.md`
- **Category**: bug
- **Planned at**: unversioned workspace snapshot, 2026-08-26

## Why this matters

`run()` can install listeners and then throw without exposing the runtime needed to dispose them. `runScripts()` disposes the last good runtime before fetching and validating its replacement, so a typo destroys the running app. Rapid overlapping reruns can also install runtimes out of order.

## Current state

```js
// src/browser.js:9-11
const runtime = new Runtime({ io: options.io || new BrowserIO(document) });
runtime.run(source);
return runtime;

// src/browser.js:18-25
active.get(script)?.dispose();
const source = script.src ? await fetch(...) : script.textContent;
const runtime = run(source, ...);
active.set(script, runtime);
```

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Browser API tests | `node --test test/browser-api.test.js test/browser.test.js` | all pass, no TODOs for lifecycle |
| Full suite | `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**: `src/browser.js`, optionally lifecycle-only methods in `src/browser-io.js`, `test/browser-api.test.js`, `test/browser.test.js`, `test/helpers/fake-dom.js`.

**Out of scope**: parser/runtime semantics, package exports, selectors, UI, dependencies.

## Steps

1. Wrap `runtime.run(source)` so any exception disposes the newly created runtime before rethrowing the original error.
2. Make replacement transactional: obtain source and fully construct/run the candidate first; only after success atomically replace `active` and dispose the previous runtime. A failed fetch, parse, open, or top-level call must leave the old runtime and listeners operational.
3. Serialize or generation-guard executions per script. When calls overlap, only the newest requested generation may become active; every superseded candidate must be disposed. Ensure independent script elements can still load concurrently only if document-order execution semantics remain intact; otherwise keep sequential document order.
4. Ensure `disposeScript` invalidates any pending generation so a late fetch cannot reactivate a disposed script.
5. Convert Plan 001 lifecycle TODOs and add a deferred-fetch race test, listener-count assertions, error identity assertion, and old-runtime-still-operates assertion.

## Done criteria

- [ ] A top-level runtime error leaves zero candidate listeners.
- [ ] A failed rerun preserves the previous app and listeners.
- [ ] Two overlapping reruns leave exactly one active listener set from the newest request.
- [ ] `disposeScript` prevents pending work from becoming active.
- [ ] Full tests and build pass.

## STOP conditions

- Transactionality requires changing `run()` from synchronous to asynchronous; preserve its synchronous public contract and report instead.
- Maintaining document order conflicts with per-script concurrency assumptions; prefer deterministic document order and document the chosen generation model.

## Maintenance notes

Any future async interpreter initialization must participate in the same candidate/commit/dispose lifecycle.
