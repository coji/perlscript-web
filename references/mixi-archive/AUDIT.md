# mixi reconstruction audit

This score measures the demo against the locally collected 2004–2005 material,
not against present-day mixi. A score above 90 means that every high-confidence
screen family is represented, the historical desktop composition is preserved,
and the remaining differences are mainly unavailable raster assets or screens
for which no complete source exists.

## Scoring model

| Axis | Weight | Full-credit condition | Current |
| --- | ---: | --- | ---: |
| Evidence-backed screen coverage | 20 | Every screen family established by the collected material has a corresponding route | 19 |
| Information architecture | 20 | Header, utility navigation, route-specific rails, panel order, and page relationships match the sources | 18 |
| Desktop geometry | 15 | 720 px canvas, 247/473 public header, 200 px login rail, and source-specific column layouts | 14 |
| Color and typography | 15 | Archived CSS tokens, 10 pt system text, link states, form colors, and orange footer are preserved | 14 |
| Period component fidelity | 15 | Dense title strips, table-like forms, tiny controls, calendars, image grids, and raster-era banner treatment | 13 |
| Behavior | 10 | Route traversal and the source-supported diary, comments, footprints, community, search, invitation, and friend-request interactions work | 9 |
| Modern safety | 5 | Responsive reflow, keyboard focus, touch targets, disclosure, and no horizontal page overflow | 5 |
| **Total** | **100** |  | **92** |

## Screen-family check

| Screen | Reference | Result | Score |
| --- | --- | --- | ---: |
| Logged-out home | Wayback 2004-03-21 and 2005-01-01 | Exact public geometry and generated grass composition | 95 |
| Member home | `sns_02_01.jpg` | Source-proportioned three-column dashboard; notice spans identity and stream columns; the central table restores diary, comment, community, and review categories | 92 |
| Footprints | `sns_02_02.jpg`, `sns05_05.jpg` | Full-width chronology and access count | 94 |
| Invitation | `sns_03_01.jpg`, `sns_03_02.jpg` | Invitation explanation, address, message, and completion state | 91 |
| Registration | `sns_03_03.jpg` | Logged-out header and period table-form layout | 93 |
| Profile editing | `sns_03_04.jpg` | Period fields, visibility text, interests, and confirmation action | 93 |
| Photo editing | `sns_03_05.jpg` | Three-photo slots, main-photo state, upload control, and warning text | 93 |
| Friend request | `sns4_01.jpg` | Recipient identity, optional message, and completion state | 93 |
| Member search | `sns4_02.jpg`, `sns05_02.jpg` | Profile criteria, keyword search, and portrait results | 92 |
| Diary detail | `sns4_03.jpg` | Diary-only rail, dated entry, comments, and comment form | 95 |
| Account/blog settings | `sns4_04.jpg` | Internal/external diary choice, blog URL, and RSS URL | 93 |
| Community home | `sns4_05.jpg` | Community identity rail, facts table, members, topics, and posting | 92 |
| Community search | `sns4_06.jpg` | Sorting, keyword/category controls, and result cards | 91 |
| Calendar | `sns4_07.jpg` | Correct August 2005 weekday alignment and mixed event types | 94 |

Profile, standalone diary-list, review, and message-list routes are included for
a coherent tour, but are not used to inflate source-fidelity scores where the
archive lacks a complete contemporary screenshot.

## Verification

- `pnpm test -- test/mixi.test.js` exercises every route and the mutable Perl
  behaviors.
- The full project check verifies formatting, types, build output, and tests.
- Browser inspection covers every route at desktop width and representative
  phone widths; the document has no horizontal overflow.
- Lighthouse snapshot scores 100 for best practices and 89 for accessibility.
  The remaining contrast findings come primarily from preserving the archived
  `#258FB8` link color and 10 px text rather than substituting modern tokens.
- All UI state and interactions remain in the embedded Perl program. JavaScript
  only boots and reruns the runtime/source editor.

## Known residual differences

- The authenticated header advertisement is a generated original, because the
  contemporary third-party advertisements cannot be redistributed as product
  assets.
- Original authenticated raster ornaments and button images were not recovered;
  CSS recreates their geometry and sampled palette.
- The member-home content is fictional and denser in names than the blurred
  contemporary capture, although its category table, column proportions, profile
  order, notice placement, marker colors, and dated shortcut rail follow it.
- Complete contemporary screenshots for normal profile, standalone diary list,
  review, and message screens remain unavailable.
