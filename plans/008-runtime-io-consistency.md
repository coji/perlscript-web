# Plan 008: Make runtime and browser I/O consistency explicit

> **Executor instructions**: Repair the six reviewed consistency defects without changing the public PerlUI syntax. Preserve the current last-good-runtime behavior and add regression coverage before broad refactoring.
>
> **Drift check (run first)**: `git diff -- src/runtime.js src/browser.js src/browser-io.js src/lexer.js src/web-adapters.js test`

## Status

- **Execution**: DONE
- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/003-transactional-browser-runtime.md`, `plans/007-perlui-1.0.md`
- **Category**: bug, architecture
- **Planned at**: working tree `0c30f87`, 2026-08-27

## Why this matters

Browser actions must not leave Perl state, rendered UI, persistent storage, routing, or listeners disagreeing about what succeeded. The current implementation has six boundary defects: watched callbacks bypass transactions, failed candidate runs leak storage and route writes, event handles survive `close`, programmatic navigation only notifies the writer, stream registration loses an overwritten factory, and `$10` has two meanings.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Focused tests | `node --test test/runtime.test.js test/browser.test.js test/web-adapters.test.js` | all pass |
| Full checks | `pnpm run check` | exit 0 |
| Browser tests | `pnpm run test:e2e -- --workers=3` | exit 0 |

## Scope

**In scope**: runtime callback transactions, reversible startup effects for storage and routing, browser handle ownership and cleanup, shared route notifications, stream registration restoration, capture-variable grammar, matching tests/types/docs.

**Out of scope**: rollback of irreversible network requests, a new Perl syntax, demo redesign, unrelated worktree changes.

## Steps

1. Run every watched callback through `Runtime.transaction()` and add a rollback regression test.
2. Add a BrowserIO effect transaction used by candidate browser runs. Stage storage and route mutations until the candidate succeeds; discard them on failure. Keep direct `run()` behavior synchronous and immediate.
3. Give each event/UI handle ownership of its cleanup callbacks. Make `close()` and reopening dispose the old handle exactly once.
4. Centralize route change publication per BrowserIO so every matching handle sees programmatic and browser navigation.
5. Make stream registration restoration-safe when the same name is installed more than once.
6. Restrict numeric capture variables to `$1` through `$9`; reject `$10` consistently in direct use and interpolation.
7. Update contracts and generated artifacts, then run focused, full, and cross-browser verification.

## Done criteria

- [x] A failed watched callback restores Perl variables and the last rendered UI.
- [x] A failed candidate rerun does not change storage or routing.
- [x] Closed or reopened event/UI handles leave no stale listeners.
- [x] All route handles observe a programmatic navigation exactly once.
- [x] Removing an adapter registration restores the previous registration.
- [x] `$10` is rejected consistently while `$1` through `$9` continue working.
- [x] Unit tests, type checks, build, and E2E tests pass.

## STOP conditions

- Staging storage or routing would require making the synchronous public `run()` API asynchronous.
- A fix would attempt to promise rollback for HTTP or another irreversible external effect; document that boundary instead.

## Maintenance notes

Future browser capabilities should declare whether their writes are reversible and should own all resources created by `open` or `watch` at the handle level.
