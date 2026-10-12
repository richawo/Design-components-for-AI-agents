# Site performance and preview preferences

Updated on 12 October 2026. The changes preserve the existing navigation,
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

### Gallery images on slower connections

Gallery cards previously downloaded 1280 px posters even at a rendered width of
308 px. The registry builder now makes 480/768 px WebP candidates at quality 90,
with content-addressed filenames, cached encoding and bounded build concurrency.
It skips candidates that would not save bytes and never enlarges a source.
The originals remain untouched and available in `srcset` for larger displays.
These are high-quality resized derivatives, not a lossless recompression claim.
Videos retain their existing files and playback behaviour.

The gallery supplies sizes matching its one-, two- and three-column layouts.
The first six posters have high fetch priority; subsequent posters stay lazy.
An unavailable hashed file falls back once to the stable original, including
when the failure happens before hydration. Browser checks cover 1440/1100/390 px
viewports at pixel ratios 1, 2 and 3, missing derivatives, stable card bounds,
progressive loading, category/history restoration and full route prefetch.
The first six desktop posters total 50,898 bytes, down from 199,718 bytes (75%
less). Smaller images are only requested when the browser selects them.

The same fresh-context Pricing-to-Components replay runs three times at 1 Mbps,
150 ms latency, 4x CPU slowdown and the browser's default renderer, with network
cache disabled. Both builds contain 243 entries and receive the same 3 seconds
for normal route prefetch. The baseline reproduces a 2.28 second image wait,
even though card DOM is ready much earlier. Image decode completion and the next
frame are proxies for visible readiness, not a physical screen measurement.

| Metric | Before | Final after |
| --- | ---: | ---: |
| Median visible poster readiness | 2,284 ms | 777 ms |
| Median posters + following frame | 2,292 ms | 786 ms |
| Max first / second click frame | 51 / 55 ms | 52 / 56 ms |
| Median card DOM readiness | 312 ms | 344 ms |
| Max long task | 151 ms | 172 ms |

The image improvement is 66%; click feedback is essentially unchanged. Both
runs pass the replay's deliberately generous 2.5 second image budget. Delaying
image responses fails the negative control at 10,009 ms. The initial patched
run measured 724 ms for images and a 144 ms maximum task; the final rebuilt run
is 7% slower for images and regresses 19% on the maximum task. That regression
is retained, not dismissed as a speedup. This shared machine is also running
other browser workloads; these samples establish the image-transfer saving,
not a uniform reduction in CPU latency. A separate existing 5 Mbps route replay
improves card readiness from the previous archived 406 ms to 366 ms and long
tasks from 139 ms to 129 ms, but still misses its 350 ms card budget on first
navigation from Home.

The final archive is
`test-results/frontend-latency-replays/design-gallery-slow-images/2026-10-11T23-59-28Z/`.
Its previous after-run is in the sibling `2026-10-11T23-56-18Z/` directory.
Production build, strict registry validation, TypeScript and all 732 unit tests
pass. An unrelated multilingual SEO test timed out while a build was running;
the complete suite passed with two workers after the build finished.

```sh
PERF_BASE=http://localhost:3000 node tests/browser/gallery-slow-connection.mjs
TEST_BASE=http://localhost:3000 node tests/browser/gallery-responsive-images.mjs
TEST_BASE=http://localhost:3000 TEST_BROWSER=webkit node tests/browser/gallery-responsive-images.mjs
```

The same image-selection, layout and missing-file recovery checks pass in
Chromium and WebKit against production build `088528b`, confirmed by the live
build marker. WebKit can speculatively request an eager image twice before
hydration; the recovery check verifies that every eager poster recovers and
requests stop, rather than imposing Chromium's request count on both engines.

### First navigation into Components

The new `gallery-route-performance.mjs` replay follows the actual header links
from Pricing and Home, first in a fresh context and then on a repeat visit.
It records click feedback, card DOM readiness, the following animation frame,
long tasks and the catalogue request timeline. It never inserts fallback links.
The existing entrance animations remain; card readiness does not mean the
700 ms decorative entrance has finished or prove physical screen presentation.

Components reads query filters on the server, making its route dynamic. Default
Link prefetch downloaded only a small shell, leaving a 163 KB decoded catalogue
(roughly 37 KB transferred locally) to download on every click. The header and
homepage primary link now request a full prefetch. This follows
[Next.js's prefetch behaviour](https://nextjs.org/docs/app/guides/prefetching)
while retaining server-rendered filters and deep links. Desktop and mobile
checks verify the complete payload arrives before the click and that navigation
reuses it. Progressive rendering still starts with 12 cards, and all 243 entries
in this test catalogue remain reachable.

The background trace also exposed two identical initial rasterisations: an
explicit mount draw followed by the first ResizeObserver notification. The
observer now supplies the initial size, avoiding that forced size read, and
unchanged pixel dimensions skip repeat work. The browser test requires exactly
one initial draw and one redraw on resize. Pixels match the original recipe
exactly at desktop/mobile widths and device pixel ratios 1 and 2.

All timing runs use 80 ms latency and 5 Mbps. Local timing remains sensitive to
other GPU-heavy tasks on this shared computer:

| Run | Max first / second click frame | Max cards + following frame | Max long task |
| --- | --- | --- | --- |
| Before, 4x CPU / SwiftShader | 178 / 192 ms | 519 ms | 198 ms |
| Prefetch only, same setup | 154 / 371 ms | 433 ms | 180 ms |
| Both fixes, same setup | 799 / 886 ms | 886 ms | 152 ms |
| Both fixes, 4x CPU / browser renderer | 44 / 52 ms | 406 ms | 139 ms |
| Both fixes, normal CPU / browser renderer | 37 / 39 ms | 95 ms | 0 ms |

The normal-device run passes the 200 ms click-feedback and 350 ms card-readiness
budgets: first visits were 86/95 ms and repeat visits 38/39 ms. It is a separate
environment, not a before/after speedup claim. The stressed runs still fail the
card budget, and the final software-renderer run regresses versus the earlier
after-run. Those failures are retained. Verified wins are elimination of the
click-time catalogue round trip after prefetch and the redundant rasterisation;
these samples do not establish a uniform latency percentage across devices.
The final 4x CPU negative control deliberately blocks the click for 300 ms and
correctly fails: 363 / 370 ms feedback, 720 ms cards and a 336 ms long task.
The normal-device negative control also fails (331 / 332 ms feedback,
391 ms cards and a 304 ms long task).
Long-task collection was corrected during profiling to include a task beginning
before, but overlapping, the click; the first two rows used the older interval.

Raw reports, profiles and screenshots are in `test-results/site-performance/`.
The archive is `test-results/frontend-latency-replays/design-gallery-route/`,
including the previous after-run and the final regression. New browser checks
are `gallery-prefetch.mjs` and `gallery-background.mjs`; history and progressive
gallery checks also pass. The production build, strict registry generation,
TypeScript and all 729 unit tests pass.
Production build `361e18a` was confirmed through the live build marker; the
desktop/mobile prefetch, background pixel comparison and history checks also
passed against `https://design.yaps.ai`.

```sh
PERF_BASE=http://localhost:3227 PERF_NATIVE=1 PERF_CPU=1 PERF_OUT=test-results/site-performance/gallery-route-native-device.json node tests/browser/gallery-route-performance.mjs
TEST_BASE=http://localhost:3227 node tests/browser/gallery-prefetch.mjs
TEST_BASE=http://localhost:3227 node tests/browser/gallery-background.mjs
```

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
The fade now lasts 380 ms, with a 180 ms release delay when leaving cards, so
crossing a small gap does not flash the other cards. Hovered and keyboard-focused
cards clear without that delay. The per-frame gap replay reproduces the old
neighbour opacity falling from 0.18 to 0.0205; it stays at 0.18 after the fix.
The measured fade rises in 357 ms (previously 173 ms). Pointer-to-first/second
frame maxima are 0.6/6.6 ms, versus 0.8/7.5 ms before, with no long tasks in
either replay. Disabling transitions fails the negative control. Keyboard,
reduced-motion, touch and layout checks pass.

Evidence: `test-results/frontend-latency-replays/design-gallery-hover-gap/2026-10-11T23-52-27Z/`.
This is the first archive for this case, so no previous after-run comparison
exists. Replay with `TEST_BASE=http://localhost:3000 node tests/browser/gallery-hover-transition.mjs`.
WebKit also passes the temporal gap replay: neighbour opacity remains 0.18 and
the fade reaches its target in 349 ms. The harness reports unavailable long-task
instrumentation as null on WebKit. The live Chromium replay passes as well
(364 ms fade, 0.18 gap opacity); these unthrottled checks establish behaviour,
not a cross-browser speed comparison.
