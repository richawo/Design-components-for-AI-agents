# Site performance and preview preferences

Verified on 11 October 2026. The changes preserve the existing navigation,
preview controls and visible animation design.

## Loading and navigation

- The site shell loads roughly 99 KB of utility CSS instead of 607 KB.
  Registry utilities load in the preview document. The registry cascade and
  theme tokens stay independent of the shell.
- Category selection updates the existing catalogue and URL without another
  server request. A returning router cache entry reads its category from the
  current URL instead of displaying stale server props. The history replay
  verifies selection, card count, direct links and zero category RSC requests.
  The existing Next history behaviour resets page scroll when returning from
  Pricing, reproduced with both filtered and unfiltered galleries; this change
  does not introduce a separate scroll-restoration system.
- Free highlighted source is generated separately at `/api/source/:slug` and
  requested when its panel approaches the viewport. The static route rejects
  Pro slugs. Pro source still uses the authenticated route.
- Opened source tabs retain their DOM when hidden, preserving their scroll
  position and avoiding repeated parsing of syntax-highlighted markup.
- The Portfolio Chart navigation payload fell from approximately 288 KB to
  46 KB; its HTML fell from approximately 652 KB to 102 KB. These are decoded,
  uncompressed sizes, not network transfer claims.

## Replay evidence

### Growing gallery

The gallery now mounts 12 cards initially and adds batches of 12 within 600 px
of the list's end. Search and category counts still use the complete lightweight
catalogue index. A keyboard-accessible load action continues focus at the first
new card. This is incremental rendering, not a virtual list: visited cards stay
mounted until a filter changes or the page is left. Posters decode asynchronously;
the existing nearby-video loading and playback limits remain in place.

With the same 233-item catalogue, the production browser replay confirmed all
233 cards remain reachable in order, without duplicates, on desktop and mobile.
An initially unmounted component can be found directly through search. Gallery
browsing requests neither live-preview documents nor component source APIs.
The history, keyboard-focus and hover-emphasis checks also passed.

The fourfold-CPU, 40 ms / 10 Mbps gallery replay measured first-render DOM count
3476 to 612 and maximum long task 1055 to 234 ms. Search first-frame maximum was
262 to 274 ms; second-frame maximum was 664 to 511 ms. The 200 ms feedback budget
still failed, so this slice proves reduced rendering work, not smooth filtering
in every case. The 250 ms blocking-input negative control also failed as expected
(326 / 566 / 312 ms, first frame / second frame / long task).

Reports are `test-results/site-performance/gallery-growth-{before,after,negative}.json`.
The catalogue and initial visible cards were unchanged between these runs.
The archive is `test-results/frontend-latency-replays/design-gallery-growth/`.

Further experiments isolated the tier control from typing, restricted layout
measurement and delayed new video sources until filter input settled. They
passed functional checks but did not establish a repeatable frame-latency win,
so they were not retained. The layout experiment measured 358 / 571 / 149 ms and
the input/video experiment 494 / 1059 / 510 ms (first / second frame / long task).
Later runs coincided with several other GPU-intensive Chromium processes on
the shared machine; those runs are not a clean causal comparison. Their raw
reports, CPU profile, trace and discarded patch remain in the ignored
`test-results/site-performance/` directory. The source changes are also saved
in the stash named `Preserve unshipped gallery input latency experiments`.
No further video playback delay or layout-animation restriction is shipped,
and the remaining frame-budget failure is recorded rather than being labelled
a complete resolution of choppiness.

The video audit found 220 MP4s totalling 27.46 MB, roughly 125 KB on average;
the largest was 409 KB. Samples already use H.264, no audio and fast-start MP4
packaging. A lossless stream-copy/remux of the largest file remained exactly
408609 bytes. No blanket recompression or reduction of video fidelity was made.

### Source navigation

The scripts use Chromium, a 1440 by 900 viewport, fourfold CPU throttling,
80 ms simulated network latency and 5 Mbps download throughput for navigation.
The navigation replay opens three components and switches their source tabs.
First and second animation frames are feedback proxies, not official INP or
physical screen-presentation measurements.

| JSON source tab | First frame, before / after | Second frame, before / after |
| --- | --- | --- |
| Portfolio Chart | 352 / 160 ms | 415 / 169 ms |
| Command Palette | 106 / 111 ms | 236 / 118 ms |
| Sortable Table | 23 / 49 ms | 98 / 119 ms |

The maximum main-thread long task across these three runs fell from 182 ms to
141 ms. The baseline exceeded the 200 ms feedback budget; the final packaged
run passed. The 250 ms blocking-click negative control recorded long tasks of
315 to 373 ms and second-frame delays above the 200 ms feedback budget.
No browser exceptions were recorded in the successful replays.

Overall page-opening timings were variable, including a slower Portfolio
Chart run, so these samples do not establish a uniform end-to-end speedup.
The reliable structural improvements are smaller payloads and removal of the
category request. Tab timing is variable: an initial after-run measured
180 / 188 / 116 ms (maximum first frame / second frame / long task); an
intermediate rerun regressed to 422 / 511 / 120 ms before the final packaged
run measured 160 / 169 / 141 ms. The final long task is 22% above the initial
after-run even though its frame feedback is faster. These shared-machine,
single-pass samples are not proof of consistent sub-200 ms responsiveness.
Catalogue additions and other browser work were being made by
other work during the session; the three measured component implementations
were unchanged. An exploratory gallery search replay still exceeded its
200 ms budget; no claim of resolving all search latency is made.

Local reports and screenshots are ignored under `test-results/site-performance/`.
The archived navigation case is `test-results/frontend-latency-replays/design-source-navigation/`.
The archive retains the initial and final runs; the intermediate timing
regression remains in `test-results/site-performance/navigation-final.json`.
Two gallery queries in this replay do not match component names. For those,
the measurement inserts a plain destination link, causing a full navigation.
That is identical before and after, but those samples do not measure Next's
prefetched card-navigation path. Command Palette uses the actual card.

## Deployment size

The growing catalogue exceeded Cloudflare's 64 MiB Worker limit. Registry
downloads now reuse the same bundled Pro source instead of embedding another
copy, and the final Worker is minified. The local runtime upload fell from
65.4 MiB to 48.6 MiB, with a size guard before upload. The download contents and
licence gate are unchanged. The packaged Worker passed the preview preference
and gallery checks, served free source successfully and rejected an
unauthenticated Pro download.

Live QA also reproduced a deployment crossing an open browser session: old
hashed preview assets returned 404 after the next release. A small pre-framework
handler now reloads on a missing same-origin Next chunk, once per failed asset
with a 60-second per-tab cooldown. It ignores application errors and external
resources, and never retries automatically if session storage is unavailable.
The browser fault-injection test blocks a chunk and requires exactly one full
reload followed by a working preview. This is recovery, not asset retention
across versions; an open preview can briefly reload during a release.

```sh
PERF_BASE=http://localhost:3000 PERF_OUT=test-results/site-performance/navigation-after.json node tests/browser/navigation-performance.mjs
PERF_BASE=http://localhost:3000 PERF_NEGATIVE=1 PERF_OUT=test-results/site-performance/navigation-negative.json node tests/browser/navigation-performance.mjs
TEST_BASE=http://localhost:3000 node tests/browser/site-preferences.mjs
TEST_BASE=http://localhost:3000 node tests/browser/gallery-focus.mjs
TEST_BASE=http://localhost:3000 node tests/browser/gallery-progressive.mjs
TEST_BASE=http://localhost:3000 node tests/browser/gallery-navigation.mjs
```

## Personalisation

The Accent control in each live preview's toolbar accepts a native colour-picker
value or a hex value. The shared preference is stored in this browser and applies
to live component demos, including those embedded on the landing page. The site
branding, navigation and Pro badges retain their original colours. There is no
colour setting in the site header.
Null means template defaults. Live previews use documented accent props and
explicit accent CSS variables; semantic status and data colours are preserved.
Monochrome components without a brand-accent token retain their palette.
Recorded gallery posters and videos retain the recorded template colours.

Per-component controls and shared-link overrides take precedence. The global
preference is included in configured snippets where a component has a colour
control, but is not written into its URL as an accidental permanent override.
Custom colours use contrasting foregrounds on supported component accent fills.

Gallery hover and keyboard focus use an 18% black overlay on surrounding cards.
The effect uses CSS, adds no React hover state and does not shift layout.
Pointer hover is disabled on touch devices; reduced motion removes the fade.
