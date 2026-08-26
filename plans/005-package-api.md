# Plan 005: Publish one consistent browser and module API

> **Executor instructions**: Make CDN globals and ESM package imports expose the same lifecycle functions where meaningful. Preserve the existing core exports and CDN filenames.
>
> **Drift check (run first)**: `shasum package.json src/index.js src/browser.js README.md dist/perlscript-web.js`

## Status

- **Execution**: DONE
- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: `plans/003-transactional-browser-runtime.md`
- **Category**: bug, dx, docs
- **Planned at**: unversioned workspace snapshot, 2026-08-26

## Why this matters

The CDN bundle exposes `PerlScript.run` and `runScripts`, but `import { run } from "perlscript-web"` fails because the ESM export points at `src/index.js`, which exports only core classes. Consumers should not receive a different API based on delivery mechanism.

## Current state

- `package.json:8-13` routes `import` to `src/index.js` and default/main to the IIFE bundle.
- `src/index.js:1-5` exports lexer, parser, runtime, and I/O only.
- `src/browser.js:6-31` exports `run`, `runScripts`, and `disposeScript`.
- `README.md` documents the global API but no ESM import example.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |
| Package | `npm pack --dry-run` | expected files, exit 0 |
| ESM probe | `node --input-type=module -e "import('perlscript-web').then(m => console.log(Object.keys(m).sort().join(',')))"` | includes `run,runScripts,disposeScript` |

## Scope

**In scope**: `src/index.js`, `src/browser.js` only if needed to avoid auto-start on module import, `package.json`, `README.md`, one package API test, generated `dist/` via the build command.

**Out of scope**: CommonJS support unless explicitly required, package publishing, renaming CDN files, changing runtime semantics.

## Steps

1. Separate side-effect-free browser API exports from browser auto-start if necessary. Importing the npm module in Node must not require a document or schedule execution.
2. Export `run`, `runScripts`, and `disposeScript` through the ESM entry while retaining all existing named exports.
3. Review `exports`, `main`, and `browser` conditions so ESM bundlers receive named modules and raw CDN consumers continue to receive the IIFE. Do not claim CommonJS support without a CJS artifact and test.
4. Add an ESM package-boundary test and README examples for ESM and CDN usage. Document that page-authored Perl has the same trust level as page-authored JavaScript.
5. Rebuild dist and run `npm pack --dry-run`; inspect the tarball list.

## Done criteria

- [ ] The ESM probe includes all core and browser lifecycle exports.
- [ ] Importing in Node has no document side effects.
- [ ] CDN global still exposes lifecycle functions.
- [ ] `npm test`, build, and pack dry-run succeed.

## STOP conditions

- Fixing conditional exports would silently break jsDelivr/unpkg main-file resolution; preserve current CDN behavior and report the unresolved condition.
- CommonJS appears to be a real existing consumer contract; add a separate design decision instead of improvising a format.

## Maintenance notes

Test the package boundary, not only relative source imports. Revisit export conditions before the first npm publish.
