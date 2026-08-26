# Plan 006: Add source-aware diagnostics and checked AST contracts

> **Executor instructions**: Add locations and structured syntax/runtime errors without migrating the codebase to TypeScript. Use checked JSDoc so token and AST variants become machine-checkable while preserving JavaScript source distribution.
>
> **Drift check (run first)**: `shasum src/lexer.js src/parser.js src/runtime.js package.json test/*.test.js`

## Status

- **Execution**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-perl-semantics.md`
- **Category**: tech-debt, dx
- **Planned at**: unversioned workspace snapshot, 2026-08-26

## Why this matters

Tokens and AST nodes carry no source range, so errors such as `Expected ;, got is` cannot identify a line, column, or excerpt. The evaluator switches on untyped string variants, making missing cases invisible to tooling. Source spans and checked discriminated unions make the hand-written parser maintainable without requiring a parser-generator or full TypeScript migration.

## Current state

- `src/lexer.js:21-26` emits tokens containing only type/value fields.
- `src/parser.js:10` throws a plain `SyntaxError` without location.
- `src/parser.js:12-116` creates untyped object-literal AST nodes.
- `src/runtime.js:25-64` dispatches on `node.type` with default runtime errors.
- `package.json` has no typecheck script or TypeScript dependency.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Tests | `npm test` | exit 0 |
| Type check | `npm run typecheck` | exit 0, no diagnostics |
| Full check | `npm run check` | tests, typecheck, and build all exit 0 |

## Scope

**In scope**: all `src/*.js`, `test/parser.test.js`, `test/conformance.test.js`, new diagnostic tests if separated, `package.json`, `package-lock.json`, and generated dist artifacts.

**Out of scope**: `.ts` conversion, parser-generator adoption, new syntax, UI error panel, Vite/Vite+ migration.

## Steps

1. Define checked JSDoc token, source-position, source-range, expression-node, statement-node, program, and filehandle interfaces. Use discriminated unions and enable checking with a minimal `jsconfig.json` or TypeScript `allowJs/checkJs/noEmit` configuration.
2. Track offset, 1-based line, and 1-based column in the lexer. Every token, including EOF, gets a start/end range. Newline normalization must keep reported line/column deterministic.
3. Give parser-created nodes ranges spanning their complete syntax. Create a structured `PerlScriptSyntaxError extends SyntaxError` with message, range, and optional source excerpt/caret. `expect`, unexpected token, unterminated literal, malformed number, and missing block close must use it.
4. Wrap runtime failures where an AST node is available in a structured runtime error carrying the node range and original cause, while preserving recognizable error messages and stack/cause chaining.
5. Add exhaustive-switch helpers using a `never` JSDoc contract so type checking fails when a new AST variant lacks parser/runtime handling.
6. Add exact diagnostic tests for inline source and CRLF-normalized source. Add `typecheck` to `package.json`; include it in `check` before build. Rebuild dist.

## Done criteria

- [ ] Every token and AST node has a source range.
- [ ] Syntax errors report line and column with stable tests.
- [ ] Runtime errors caused by source nodes retain a cause and range.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` pass.
- [ ] Source remains JavaScript; no parser generator is introduced.

## STOP conditions

- Type checking requires widespread unsafe casts or disabling checks on core parser/runtime files; report the problematic union instead.
- Source ranges require changing normalized-source behavior in a way that breaks line mapping; preserve normalized line/column and document offset semantics.
- Runtime wrapping would conceal the original error identity needed by Plan 003 tests; preserve `cause` and adapt assertions deliberately.

## Maintenance notes

All future token/node variants must carry ranges and join the discriminated union. A later UI can consume structured errors without parsing message strings.
