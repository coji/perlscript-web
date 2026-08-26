# Plan 007: Build PerlUI 1.0

> **Product thesis**: Build a modern reactive UI runtime without extending the
> Perl 1 Web Profile grammar. Perl programs describe UI with ordinary calls,
> mutate ordinary Perl globals, and name event subroutines. The browser runtime
> owns rendering, scheduling, lifecycle, persistence, and asynchronous I/O.

## Status

- **Execution**: TODO
- **Priority**: P1
- **Effort**: XL, delivered as independently releasable milestones
- **Risk**: HIGH
- **Depends on**: Plans 001-006
- **Category**: product, runtime, UI
- **Planned at**: `perlscript-web@1.0.0-rc.1`

## Product position

**Perl 1.0 syntax. 2026 runtime.**

PerlUI is not a Perl-flavoured React port and it is not a direct DOM API. It is
the UI layer of `perlscript-web`: state is held in Perl scalars, arrays, and
hashes; views are named subroutines; events invoke named subroutines; and the
runtime turns structured UI instructions into safe, incremental DOM updates.

The public story is:

> The future of UI, written in 1987.

The technical promise is:

> Change the Perl data, and the interface follows.

## Non-negotiable design rules

1. **No new language syntax.** PerlUI 1.0 must not add tokens, JSX, references,
   objects, closures, `my`, `async`/`await`, or other modern Perl syntax.
2. **No DOM objects in Perl.** Selectors may identify a mount point, but Perl
   source never receives an element or browser event object.
3. **No HTML string rendering.** Text remains text. Elements, attributes, and
   events are emitted as structured instructions so user data cannot become
   markup accidentally.
4. **Ordinary Perl state.** `$scalar`, `@array`, and `%hash` remain the source of
   truth. A second JavaScript state model must not be required.
5. **Named subroutines are the unit of behaviour.** Event handlers and views are
   referred to by name, matching the existing `watch(HANDLE, "sub")` model.
6. **Runtime complexity stays below the language boundary.** Scheduling, DOM
   reconciliation, async delivery, storage, and cleanup belong in JavaScript.
7. **Progressive adoption.** Existing `dom:` and `event:` filehandle programs
   keep working unchanged throughout `1.x`.
8. **Deterministic and testable.** A view must produce the same UI instruction
   tree for the same Perl state, independent of a real browser.

## Proposed authoring model

This is a design sketch, not yet the frozen API:

```perl
$count = 0;

sub increment {
    $count++;
}

sub view {
    begin("main", "class", "counter");

    begin("h1");
    text("Perl Counter");
    end();

    begin("button", "type", "button");
    on("click", "increment");
    text("Count: $count");
    end();

    end();
}

open APP, ">ui:#app";
mount(APP, "view");
```

The deliberately small primitive surface is:

| Primitive | Responsibility |
|---|---|
| `open APP, ">ui:#app"` | Open a structured UI mount filehandle |
| `mount(APP, "view")` | Own the mount and render a named view subroutine |
| `begin(tag, ...)` | Begin a safe element with attribute name/value pairs |
| `text(value)` | Emit a text node |
| `on(event, "sub")` | Bind an event to a named Perl subroutine |
| `key(value)` | Give a repeated subtree stable identity |
| `bind(property, "scalar")` | Two-way bind a form property to a scalar name |
| `end()` | Close the current element |

Convenience functions such as `button` or `heading` should be proven as a Perl
library or later additive built-ins. They must not obscure the minimal contract.

## Runtime model

### Render

During `mount`, the named view runs in a render context. UI calls append to an
in-memory instruction tree rather than mutating the DOM immediately. A malformed
tree fails before commit. A valid tree is reconciled with the previously
committed tree and applied atomically to the mount point.

The instruction tree is an implementation detail, not a user-visible virtual
DOM API. The first implementation should favour correctness and identity
preservation; optimization comes after measurements.

### State and scheduling

All assignments and collection mutations already pass through `Runtime.assign`
or built-ins such as `push`. While a mounted app is active, these operations mark
it dirty. The runtime batches changes made during one top-level action and
renders once after the action completes.

Milestone 1 may rerun the root view. Later milestones may record variable reads
per component and rerun only dependent subtrees. Fine-grained tracking must not
change observable Perl semantics.

### Events

`on("click", "increment")` installs a runtime-owned listener. The listener calls
the named subroutine, reports errors through the existing error channel, and
commits a render only after successful completion. On failure, the last good DOM
and state snapshot remain visible where practical; the exact rollback boundary
must be specified before implementation.

### Form binding

Perl 1 has no scalar references suitable for a binding API, so bindings use a
documented variable name string. `bind("value", "name")` reads `$name` while
rendering and assigns to `$name` on input. Supported properties and events are a
small allowlist with IME-safe behaviour.

### Lists and identity

Repeated UI requires explicit keys. A missing key is allowed only where index
identity is safe. Keyed reconciliation must preserve input selection, focus,
and element identity when arrays are inserted, removed, filtered, or reordered.

### External capabilities

Async and persistence remain filehandle-shaped instead of introducing promises:

- `storage:` exposes durable local state through a named, versioned adapter.
- `http:` exposes request completion as an event source and response data as a
  readable handle.
- timers and WebSocket messages may become event handles after the same resource
  lifecycle contract is proven.

These capabilities must be separately disposable and must not be prerequisites
for the initial renderer.

## PerlUI 1.0 scope

### Required

- Structured, text-safe element rendering into one mount point
- Attributes, boolean attributes, and named event handlers
- Scalar form binding for text inputs, checkboxes, and selects
- Batched rerender after top-level execution and event handlers
- Keyed list reconciliation with focus and input-value preservation
- Nested view subroutines with deterministic ownership and cleanup
- Transactional failed renders that preserve the last good UI
- Structured source-aware errors for invalid UI operations
- Disposal of all DOM listeners and resources
- Browser-independent renderer tests plus Chromium, Firefox, and WebKit E2E tests
- One canonical Counter, Todo, and Guestbook example
- A normative `PerlUI 1.0` profile document and stable TypeScript declarations
- CDN, ESM, and automatic-script entry points consistent with the current package

### Targeted if the core remains small

- `storage:` persistence for scalar, array, and hash state
- `http:` read/event resource with cancellation on disposal
- DOM-less HTML rendering for server or build-time output

### Explicitly after 1.0

- Resumability without hydration
- Multi-client synchronization and conflict resolution
- WebSocket-backed shared arrays/hashes
- Streaming server rendering
- Component-scoped lexical state
- Compiler or bytecode optimizations
- DevTools timeline and time-travel state inspection
- AI-specific primitives

The post-1.0 list is the research path, not a launch checklist. PerlUI 1.0 must
first make local interactive applications small, reliable, and unsurprising.

## Delivery milestones

### M0 — Freeze the contract before code

**Deliverables**

- Add `docs/PERLUI-1.0.md` as a release-candidate normative contract.
- Write Counter, Todo, and Guestbook sources against the proposed primitives.
- Create negative examples for unsafe HTML, invalid nesting, unknown handlers,
  duplicate keys, and writes outside a render context.
- Decide the event failure state boundary: Perl state rollback, DOM-only rollback,
  or documented error-state commit.

**Exit criteria**

- All three examples are readable without JavaScript knowledge.
- Every primitive has specified arguments, return value, lifecycle, and errors.
- No example requires a grammar change or direct DOM access.

### M1 — Static structured renderer

**Deliverables**

- Add a UI instruction model and pure validation layer.
- Add a DOM renderer behind a dedicated `UIIO` or equivalent interface.
- Implement `>ui:`, `mount`, `begin`, `text`, and `end`.
- Render once after top-level program execution.

**Exit criteria**

- Static Counter markup renders identically in fake DOM and real browsers.
- Text never becomes HTML; unsafe tag and attribute operations fail explicitly.
- A malformed candidate render leaves the existing mount untouched.

### M2 — State, events, and batching

**Deliverables**

- Implement dirty tracking through assignment and collection mutations.
- Implement `on` with named subroutines.
- Batch one render after each successful top-level action.
- Integrate listener cleanup with `Runtime.dispose()` and transactional reruns.

**Exit criteria**

- Counter updates without querying the DOM from Perl.
- Multiple mutations in one event cause one committed render.
- Failed handlers keep the last good DOM and report one structured error.
- Repeated reruns leave exactly one active listener set.

### M3 — Forms and keyed collections

**Deliverables**

- Implement allowlisted scalar `bind` semantics.
- Implement keyed child reconciliation.
- Port the editable Guestbook and add a Todo example.
- Add focus, selection, IME, reorder, filter, and removal tests.

**Exit criteria**

- The Todo and Guestbook contain no `dom:` or `event:` handles.
- Typing does not lose focus or move the cursor during rerenders.
- Keyed nodes preserve identity across inserts and reorders in three browsers.

### M4 — Components and developer contract

**Deliverables**

- Define nested view ownership using named subroutine calls.
- Add source-aware UI stack frames and render-phase diagnostics.
- Publish stable ESM and browser types.
- Document accessibility defaults, lifecycle, performance, and escape hatches.

**Exit criteria**

- Components compose without JavaScript wrappers or new Perl syntax.
- Errors identify the Perl source operation and component/view stack.
- Existing Profile 1.0 conformance tests remain unchanged and green.

### M5 — PerlUI 1.0 release candidate

**Deliverables**

- Replace the Pages hero demo with the PerlUI Guestbook.
- Present the current filehandle API as the low-level compatibility layer.
- Benchmark startup, update, keyed reorder, and disposal against fixed budgets.
- Complete API review, accessibility audit, security review, and package review.

**Exit criteria**

- `pnpm run check` and all-browser E2E pass from a clean checkout.
- Counter, Todo, and Guestbook work from npm, ESM, and jsDelivr builds.
- No grammar additions were made for PerlUI.
- The normative profiles and package exports match shipped behaviour.
- A failed rerun or render never destroys the last working app.

## Architecture changes by area

| Area | Expected change |
|---|---|
| `src/runtime.js` | Mutation hooks, render context, batching, UI built-ins |
| `src/io.js` | Optional capability interfaces without browser coupling |
| `src/browser-io.js` | Preserve existing low-level handles unchanged |
| New UI modules | Instruction validation, reconciliation, DOM commit, bindings |
| `src/browser.js` | Mount lifecycle participates in transactional replacement |
| `src/types.js` | UI instructions, render frames, and capability contracts |
| `types/` | Public UI runtime and option declarations |
| `test/` | Pure renderer, scheduler, reconciliation, failure, disposal tests |
| `e2e/` | Focus, IME, keyed identity, rerun, and cross-browser behaviour |
| `docs/` | Normative PerlUI profile and migration/authoring guides |

## Verification strategy

Tests must be layered so browser screenshots are not the primary correctness
oracle:

1. **Conformance** — existing language behaviour remains unchanged.
2. **Instruction validation** — exact trees and exact source-aware failures.
3. **Scheduler** — mutation batches, nesting, errors, and disposal with no DOM.
4. **Reconciliation** — node identity and operation order with the fake DOM.
5. **E2E** — focus, cursor, IME, form controls, and events in three browsers.
6. **Packaging** — npm tarball, ESM imports, IIFE globals, CDN example.
7. **Performance** — deterministic operation counts first; wall-clock budgets only
   for representative browser benchmarks.

Every milestone ends with `pnpm run check` and the relevant Playwright suite.

## Decision gates

Stop and review before continuing when any of these occurs:

- A required feature needs new Perl grammar rather than a runtime primitive.
- Form binding requires exposing DOM/event objects to Perl.
- Reconciliation cannot preserve focus and selection deterministically.
- State rollback semantics become more complex than the event model can explain.
- A convenience API becomes larger than the interpreter profile itself.
- Existing `dom:`/`event:` programs need observable behaviour changes.

## First implementation slice

Do not begin with the full roadmap. The first PR should contain only:

1. the normative draft for `>ui:`, `mount`, `begin`, `text`, and `end`;
2. a static Counter acceptance test;
3. the instruction validator and one-shot DOM commit;
4. no events, binding, persistence, async, or optimization.

That slice answers the highest-risk question early: can a strict Perl 1-shaped
program describe safe, comprehensible UI without changing the language?
