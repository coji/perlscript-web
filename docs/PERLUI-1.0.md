# PerlUI 1.0 Profile

Status: release-candidate design contract

PerlUI is the structured, reactive UI layer of `perlscript-web`. It uses the
unchanged [Perl 1 Web Profile 1.0](./PERL1-WEB-PROFILE.md): PerlUI adds browser
built-ins and a `ui:` filehandle, not language syntax.

## Design promise

> Perl 1.0 syntax. 2026 runtime.

A PerlUI program keeps application state in ordinary Perl scalars, arrays, and
hashes. Named subroutines describe views and handle events. The runtime builds,
validates, and incrementally commits structured UI without exposing DOM or event
objects to Perl.

## Mount filehandle

```perl
open APP, ">ui:#app";
mount(APP, "view");
```

`>ui:<css-selector>` opens the first matching element as an owned UI mount. The
selector follows the same pass-through rules as `dom:` selectors. A missing
element, malformed spec, duplicate mount, or non-UI handle passed to `mount`
produces a structured runtime error.

`mount(HANDLE, "subroutine")` renders the named subroutine immediately. The
subroutine must exist. A runtime owns its mount, listeners, and bindings until
`dispose()` or a successful transactional script replacement.

## Render instructions

Render instructions are valid only while a mounted view is executing.

### `begin(tag, [attribute, value]...)`

Begins an element and makes it the current element. Tags and attribute names are
validated. Event-handler attributes, HTML injection properties, and active
document tags are rejected. Boolean attributes are present only for Perl-true
values. Other attribute values are converted to text.

### `text(value)`

Appends a text node to the current element. The value is never interpreted as
HTML.

### `on(event, "subroutine", [arguments...])`

Binds an event on the current element to a named subroutine. Values after the
subroutine name are captured from that render and become the handler's `@_`.
The handler receives no DOM event object. `submit` handlers prevent normal
browser submission. An unknown handler or invalid event name fails the candidate
render.

```perl
on("click", "remove_item", $i);
```

### `key(value)`

Assigns stable sibling identity to the current element. Keys must be unique
among siblings. Keyed reconciliation preserves compatible element identity,
focus, selection, and form state across insertion, removal, filtering, and
reordering.

### `bind(property, "scalar")`

Two-way binds an allowlisted form property to a global scalar. Profile 1.0
supports `value` on `input`, `textarea`, and `select`, and `checked` on checkbox
and radio inputs. A binding writes to the scalar during the browser event and
then participates in the same transactional render as a named event handler.

The scalar is named without `$` because Perl 1 has no reference type suitable
for the public contract:

```perl
bind("value", "message");
```

### `end()`

Closes the current element. Closing the synthetic root, leaving elements open,
or calling an instruction outside a render fails the candidate render.

## State and rendering

Assignments, postfix updates, and supported array mutations mark mounted UI
dirty. Changes made during one top-level program, event handler, or binding event
are batched. After the action succeeds, every dirty mount renders once.

The first implementation may rerun each dirty root view. This is observable only
through the resulting UI: render subroutines must not perform external effects.
Later dependency tracking may reduce work without changing Profile 1.0 behaviour.

## Transactions and errors

Browser actions are transactional:

1. snapshot Perl scalar, array, and hash state;
2. run the binding assignment or named event handler;
3. build and fully validate candidate UI trees;
4. commit the candidates;
5. keep the new state and UI only after success.

If the handler or candidate render fails, the Perl state snapshot and last good
UI remain active. The error is reported through the existing `onError` contract.
Listener cleanup and later events continue to work.

Top-level startup follows the existing runtime transaction: a failed candidate
runtime is disposed, and a previous successfully running script is preserved.

## Reconciliation

The instruction tree is an internal representation, not a public virtual-DOM
API. Compatible unkeyed nodes may be reused by position. Compatible keyed nodes
are reused by key even when their position changes. A key collision is an error.

The renderer updates form properties only when the state value differs from the
live property. This avoids moving the cursor during ordinary controlled input.

## Components

Any named subroutine called while rendering may emit instructions into the same
tree. This is the Profile 1.0 component model; no package, object, closure, or
new component syntax is introduced. Arguments continue to use dynamic `@_`.

```perl
sub title {
    begin("h1");
    text($_[0]);
    end();
}

sub view {
    do title("Guestbook");
}
```

## Accessibility

PerlUI emits native elements and attributes. It does not replace native
semantics with custom roles. Application authors remain responsible for labels,
names, heading order, focus movement, and live-region choices. The renderer must
not remove focus merely because unrelated state changed.

## Compatibility

- Existing `dom:` and `event:` handles keep their Profile 1.0 behaviour.
- Existing programs do not become reactive unless they call `mount`.
- UI built-ins used outside a render or mount fail explicitly.
- Direct DOM objects, event objects, HTML strings, and JavaScript callbacks are
  not part of PerlUI 1.0.

## Canonical Counter

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
