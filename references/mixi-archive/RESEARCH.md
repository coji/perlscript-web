# mixi 2004–2005 reconstruction ledger

This ledger separates facts visible in contemporary material from choices that
must be reconstructed. It is the visual source of truth for the archive demo.
The downloaded pages and screenshots live under `raw/` and remain local-only.

## Reconstruction target

- Logged-out page: the public page captured on 2004-03-21. The same grass-and-
  sky composition and login geometry remained in the 2005-01-01 capture.
- Logged-in product: the interface documented by BB Watch in November 2004.
- Demo content: fictional 2005 posts and generated portraits may differ, but
  navigation, information hierarchy, density, color, typography, borders, and
  controls should follow the contemporary interface.
- Modern concessions: responsive reflow, keyboard focus, minimum touch targets,
  and explanatory archive labels may be added without changing the desktop
  composition at the historical reference width.

The date in the demo title describes its fictional content, not a claim that
every pixel came from one day in 2005.

## Chronology

| Date | Evidence | Confidence |
| --- | --- | --- |
| 2004-02-22 | Test service started | Official chronology |
| 2004-03-03 | Formal launch; invitation-only; beta-version logo | Official chronology |
| 2004-03-21 | Earliest complete public-page capture collected here | Exact archived HTML, CSS, and image assets |
| 2004-11 | Home, footprints, invitation, registration, profile editing, diary, community, search, calendar, and friend-request screens | Contemporary full-page screenshots and article text |
| 2005-01-01 | Public page still uses the same 720 px grass-and-sky composition | Exact archived HTML and CSS |

Official chronology:
`https://mixi.jp/chronology.pl?mode=main`

## Collected sources

### Public pages

| Capture | Local material | Original |
| --- | --- | --- |
| 2004-03-21 | `raw/wayback-2004-03-21/`: HTML, CSS, and all 20 referenced image assets | `https://web.archive.org/web/20040321040003/http://mixi.jp/` |
| 2005-01-01 | `raw/wayback-2005-01-01/`: HTML, CSS, and surviving header assets | `https://web.archive.org/web/20050101043207/http://mixi.jp/` |

### Logged-in and registration screens

| Published | Files | Screens established | Article |
| --- | --- | --- | --- |
| 2004-11-04 | `sns_02_01.jpg`, `sns_02_02.jpg` | User home; recent footprints | `https://bb.watch.impress.co.jp/column/socialn/2004/11/04/` |
| 2004-11-11 | `sns_03_01.jpg`–`sns_03_06.jpg` | Invitation mail; invite landing with inviter profile; registration; profile editing; photo upload; linked portrait-maker example | `https://bb.watch.impress.co.jp/column/socialn/2004/11/11/` |
| 2004-11-18 | `sns4_01.jpg`–`sns4_07.jpg` | MyMixi request; user search; diary and comments; external-blog settings; community home; community search; calendar | `https://bb.watch.impress.co.jp/column/socialn/2004/11/18/` |
| 2004-11-25 | `sns05_01.jpg`–`sns05_05.jpg` | Interview portrait; expanded user search; Friendster comparison; mikly; footprints | `https://bb.watch.impress.co.jp/column/socialn/2004/11/25/` |

## Exact public-page geometry

These values come directly from the archived HTML rather than screenshot
measurement.

- The page is left-aligned and exactly 720 px wide, with no body margin.
- The 2004 header is 720 × 96 px: a 247 px logo slice and a 473 px banner/menu
  region. The 2005 New Year header is 99 px high and its menu slice is 38 px.
- The main photograph is a 720 × 350 px image mosaic. Its columns are 245 px,
  260 px, and 215 px. The bottom-right slice contains the grass and two women;
  the upper slices contain the sky and the “community entertainment” copy.
- The login rail is 200 × 160 px inside the 215 px right column. The email and
  password inputs are 20 px high and respectively 130 pt and 90 pt wide.
- The login button is a 93 × 18 px image. The registration button is a
  200 × 24 px image with a separate hover-state asset.
- The public-page footer is 720 px wide. It uses 20 px navigation and a 1 px
  separator before the copyright row.
- Images, tables, image maps, and spacer GIFs own most of the layout. Rounded
  corners and navigation states are raster assets, not CSS border-radius.

## Exact CSS tokens

The 2004 values below are copied from `mixi.css`; the 2005 capture retains them.

| Role | Value |
| --- | --- |
| Body and table text | `10pt`, `#333333` |
| Small text | `10px`; alternate small text `11px` |
| Link and visited link | `#258FB8` |
| Active/hover link | `#996600` |
| Link hover background | `#FFF4E0` |
| Comment control background/border | `#FFFFFF` / `#877065` |
| Comment control hover background | `#F7F0E6` |
| Input, textarea, select background | `#FDF9F2` |
| Input, textarea, select border | `1px solid #F2DDB7` |
| Scrollbar face | `#F2DDB7` |
| Scrollbar light/highlight | `#D3B16D` / `#FFF4E0` |
| Footer orange | `#FF9933` |
| Footer navigation | `#FEC977` |
| Footer separator | `#FFCC99` |

The stylesheet does not declare a body font family. Contemporary Windows
screens therefore render with the browser's Japanese sans-serif default. A
faithful desktop approximation is `"MS PGothic", "ＭＳ Ｐゴシック", sans-serif`,
not a modern web font.

## Logged-in visual grammar

The following is consistently visible across the November screenshots.

- A fixed-width, very dense desktop canvas with a large illustrated mixi logo
  at upper left, a 468 × 60 ad/banner region, and an orange image-based global
  menu.
- A second, narrower pill-shaped utility navigation appears below the main
  header. Its contents change with the current context.
- Home is a three-column dashboard: identity/MyMixi at left, update streams in
  the wide center, and dated shortcuts at right.
- Inner screens commonly use a narrow left rail and a wide content panel.
  Diary detail adds calendar, recent diaries/comments, and month archives to
  the left rail. Community home shows members plus latest topics and events.
- Panels use a dark beige title strip, pale cream rows, orange rules, square
  tables, and tiny image ornaments. There is almost no open whitespace.
- Form labels live in a colored left table cell. Inputs remain native-looking
  Windows-era controls; submit buttons are small, dark raster-style controls.
- Links are underlined blue. Red, green, and blue diamond-like image markers
  distinguish stream types and freshness.
- The repeated exact colors found in the lossily compressed screenshots include
  `#F3DDB6` (beige surfaces), `#FFF4E0` (cream), and `#FFD8AF` (diary surround).
  Bright navigation oranges cluster around `#F69223`–`#FAA646`; treat that
  range as screenshot-derived until the original navigation assets are found.

## Product behavior established by contemporary text

- The home page aggregates recent MyMixi diaries, comments on one's own diary,
  and recent community topics.
- Adding a MyMixi requires a request message and approval.
- Search supports name/nickname plus profile attributes such as sex, age,
  current location, and birthplace.
- A diary can contain up to three images and supports comments. An external
  blog can be connected to the diary through RSS.
- A community home shows participants and recent topics/events; communities
  appear on participating users' profiles.
- Calendar combines community events, MyMixi birthdays, weather, and private
  schedule entries.
- Footprints show visitors chronologically and maintain an access count.

## Confidence and unresolved gaps

| Item | Confidence | Remaining work |
| --- | --- | --- |
| Grass login composition and dimensions | Exact | None for 2004-03; 2005 header variations are only partly collected |
| Public colors, type sizes, input treatment | Exact | None |
| November home, footprints, diary, community, search, calendar, friend request | High | Original raster UI assets are unavailable, so some orange/beige values are sampled from JPEGs |
| Authenticated user profile page | Medium | Invite landing proves the profile table and friend grid, but a full normal `show_friend.pl` screenshot from 2004–2005 is still missing |
| Diary list page | Medium | Diary detail and home update lists are exact references; a full standalone list screenshot is still missing |
| Message list/detail | Low | Navigation and message entry points are visible, but no complete contemporary message screen has been collected |
| Exact changes during calendar year 2005 | Medium | January public capture and 2004 November product screens bracket the current target; more dated 2005 authenticated screenshots would improve precision |

## Implemented reconstruction

- The historical desktop breakpoint uses the exact CSS palette, a period
  Japanese system-font stack, a 720 px canvas, dense three-column home, and
  two-level image-navigation proportions.
- Login, home, diary detail, community home, footprints, profile, diary list,
  and messages share the reconstructed 2004 visual grammar.
- Profile pages expose their latest diaries directly, followed by the MyMixi
  grid, matching the contemporary information hierarchy.
- Profile, diary-list, and message details are deliberately conservative where
  complete contemporary screenshots have not yet been found.
- Below 720 px the page reflows into one readable column with touch-sized
  controls; this does not alter the historical desktop composition.
