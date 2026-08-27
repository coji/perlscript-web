# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow Semantic Versioning.

## [Unreleased]

### Added

- Host-registered `stream:` filehandles with asynchronous reads, writes, EOF notifications, cancellation, and the `registerStream` browser API.
- Persistent `storage:local:*` and tab-scoped `storage:session:*` filehandles with Perl-style `>` replacement writes.
- JSON bridge built-ins for constructing and consuming structured text protocols through ordinary filehandles.
- A BYOK PerlGPT demo whose Perl program owns the request, settings, conversation state, and streamed Responses API events while JavaScript supplies generic HTTP, storage, and secret adapters.
- Optional generic `stream:http` and `stream:secret` web adapters with SSE delivery, host-side credential resolution, and cancellable requests.
- Redacted runtime snapshots and metadata-only observation through `runtime.inspect()` and `runtime.subscribe()`.
- A PerlGPT source outline and live Runtime Inspector for state, filehandles, component calls, renders, transactions, and I/O activity.
- Hash and History routers through bidirectional `route:` filehandles, including Back/Forward observation and same-origin route validation.
- Read-only, watchable `clock:` filehandles with runtime-owned timer disposal.
- Regular-expression capture variables `$1` through `$9` for Perl-native route parameters.

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
- Transactional watched callbacks, staged storage/route writes during reruns, handle-owned listener cleanup, shared route notifications, restoration-safe stream registration, and consistent rejection of capture variables beyond `$9`.
- Editable BBS and hello examples.
- Generated TypeScript declarations and Chromium, Firefox, and WebKit end-to-end coverage.

### Changed

- Migrated development, CI, packing, and publishing from npm lockfiles to pnpm 11.
- Updated Playwright, esbuild, and TypeScript to their current releases.
- Switched the JavaScript bundle task to esbuild's programmatic API for portable pnpm execution.

[1.0.0-rc.1]: https://github.com/coji/perlscript-web/releases/tag/v1.0.0-rc.1
[1.0.0]: https://github.com/coji/perlscript-web/releases/tag/v1.0.0
