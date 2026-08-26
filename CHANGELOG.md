# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow Semantic Versioning.

## [1.0.0] - 2026-08-26

### Added

- PerlUI 1.0 structured rendering with `ui:` mounts and the `mount`, `begin`, `text`, `on`, `key`, `bind`, and `end` browser built-ins.
- Batched state-driven rerenders, named event arguments through `@_`, two-way scalar form binding, and keyed DOM reconciliation.
- Transactional event/render rollback, component-aware UI diagnostics, and deterministic listener disposal.
- Canonical Counter, Todo, and fully PerlUI-generated editable Guestbook examples.

## [1.0.0-rc.1] - 2026-08-26

### Added

- Perl 1 Web Profile 1.0 with scalars, lists, arrays, hashes, subroutines, dynamic `@_`, control flow, regex matching, and structured diagnostics.
- Browser filehandles for DOM input, safe text output, and event streams.
- Transactional script reruns, listener disposal, overlapping-load protection, and configurable error handling.
- Editable BBS and hello examples.
- Generated TypeScript declarations and Chromium, Firefox, and WebKit end-to-end coverage.

### Changed

- Migrated development, CI, packing, and publishing from npm lockfiles to pnpm 11.
- Updated Playwright, esbuild, and TypeScript to their current releases.
- Switched the JavaScript bundle task to esbuild's programmatic API for portable pnpm execution.

[1.0.0-rc.1]: https://github.com/coji/perlscript-web/releases/tag/v1.0.0-rc.1
[1.0.0]: https://github.com/coji/perlscript-web/releases/tag/v1.0.0
