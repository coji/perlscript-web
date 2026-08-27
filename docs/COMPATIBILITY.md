# Compatibility policy

## What “Perl 1.0” means here

The project takes syntax and value-model inspiration from the 1987 Perl 1.0 language, then exposes the browser as filehandles. It does not claim binary compatibility, complete grammar compatibility, or complete standard-library compatibility with the historical interpreter.

The normative contract is [Perl 1 Web Profile 1.0](./PERL1-WEB-PROFILE.md). The historical Perl 1.0 source and manual are reference material used to prevent accidental modern-Perl syntax from entering the profile.

## Compatibility classes

| Class | Meaning |
|---|---|
| Compatible | Syntax and observable behavior are covered by the profile and conformance tests. |
| Browser extension | Not historical Perl; intentionally maps browser behavior into I/O. |
| Adapted | Perl-shaped behavior with explicitly documented browser/JavaScript constraints. |
| Unsupported | Rejected rather than accepted with guessed semantics. |

## Profile inventory

| Area | Class | Notes |
|---|---|---|
| Scalars, arrays, hashes | Compatible profile | Bounded to documented literal, indexing, and assignment rules. |
| Perl truth values | Compatible profile | True is `1`; false is empty string; string `"0"` is false. |
| Subroutines and `@_` | Compatible profile | Globals plus dynamically scoped `@_`; no general `local`. |
| Regex matching | Adapted | JavaScript RegExp engine and flags; `$1`–`$9` captures, no substitution. |
| `open`, `select`, `print`, `<HANDLE>` | Adapted | Backed by memory or DOM filehandles. |
| `watch`, `clear` | Browser extension | Explicitly non-historical. |
| `ui:` and PerlUI built-ins | Browser extension | Structured reactive UI; no grammar additions. |
| `css:` filehandles | Browser extension | Runtime-owned stylesheets written as ordinary text output. |
| `route:` filehandles | Browser extension | Hash or History routing through readable, writable, watchable I/O. |
| `clock:` filehandles | Browser extension | Unix time input with disposable interval events. |
| DOM/event objects | Unsupported | Never exposed to Perl source. |
| Filesystem/process APIs | Unsupported | Browser-only runtime. |

## Versioning

- Patch releases fix behavior that contradicts the profile.
- Minor releases add syntax, built-ins, filehandle kinds, or optional APIs without breaking the profile.
- Major releases may change existing syntax, value semantics, browser I/O behavior, or lifecycle contracts.
- Every language change requires conformance tests and a profile update in the same change.
- PerlUI additions that do not alter language semantics follow the separately versioned [PerlUI 1.0 Profile](./PERLUI-1.0.md).
