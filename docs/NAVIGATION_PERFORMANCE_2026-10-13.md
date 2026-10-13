# Navigation and block organization audit

The reported delay was the wait after selecting a destination, before its page appeared. The live baseline reproduced it: the first gallery navigation took 2.276 seconds, with a full route response still being requested after the click. The page's first animation frame was relatively quick, so measuring that frame alone would have missed the problem.

## Changes shipped

- Corrected the OpenNext cache configuration and deployment preparation. Public prerendered routes now return `x-opennext-cache: HIT` rather than running through a dummy cache on every request.
- Prerendered the component gallery. Query filters restore in a small client boundary, keeping full server-rendered browsing, native history, saved filters and keyboard navigation. Filtered URLs conceal the unfiltered cards until the selected view is ready.
- Added delayed, cancellable navigation feedback through Next.js link status. It appears after 120ms on a genuinely pending route and belongs to the latest navigation. A completed or superseded route removes it.
- Prerendered the generic account header and loading shell. Plan, welcome and pending options still restore from the URL. Account identity, entitlement and licence data remain in authenticated APIs with `private, no-store` responses.
- Reclassified the 11 composed blocks by their purpose: four dashboards, two collaboration apps, one media app, one project workspace, one report, one settings page and one landing page. The site, Markdown companions and validation use one shared taxonomy.

Public implementation commits: `b10d581`, `2de6eaa`, `c32bd99`, `465c1ec`, `da51322`, `907128a`. Private classification: `aebe772`. The account deployment initially failed because newly published Dutch blog metadata exceeded the tested character limit. The separate editorial correction `a912eec` resolved that failure; Cloudflare confirmed a successful production build for public commit `1e233d2`.

## Live before and after

Isolated Chromium replay, 4x CPU slowdown, 5 Mbps downstream, 80ms latency, three-second origin dwell. Each scenario has a first visit and a repeat visit. Values below measure click to the next destination frame after the expected DOM is ready; they are not a promise that every entrance animation has finished.

| First navigation | Before | After |
| --- | ---: | ---: |
| Gallery | 2276ms | 538ms |
| Blocks | 1632ms | 302ms |
| Component detail | 1627ms | 557ms |
| Block detail | 2189ms | 511ms |
| Mobile gallery | 450ms | 462ms |
| Keyboard gallery | 885ms | 516ms |

The maximum across those six shared scenarios fell from 2276ms to 557ms, a 75.5% reduction. Mobile gallery performance was essentially unchanged; the desktop routes had the largest improvement. All destination frames stayed on the chosen route, and neither baseline nor final replay had page errors.

The extended final matrix also covered Pricing, Account, a category page, Docs and Blog: 22 visits in total. Account fell from 1530ms first / 1667ms repeat in the preceding deployed matrix to 169ms first / 68ms repeat after its shell became static. The live account document returned a cache HIT; its entitlement API remained private and uncached.

Twenty-one final visits were within the 700ms destination budget. The cold blog visit took 836ms and contained a 487ms main-thread task under CPU throttling; its repeat took 160ms. The full matrix therefore correctly reports a failed budget, rather than concealing this outlier. Public cache checks, navigation state checks and the common six-scenario comparison passed. Browser work can still contribute to delay even when the server wait is removed.

## State and negative-control verification

- Desktop and 390px tests restore category, search and tier filters, fast edits, native query changes and Back/Forward history without server filter requests or stale selections.
- A 1200ms script delay verifies the first visible filtered cards are correct. Disabling that guard deliberately makes the test fail on the default cards, establishing that it detects the original visual defect.
- Blocking a route response for three seconds verifies feedback appears in approximately 120–130ms. Selecting a second destination cancels the old indicator; a late first response cannot replace the newer route. Modifier clicks open a separate tab without a pending state on the source page.
- Six account fixtures cover signed-out and signed-in plan selection, welcome, pending-payment refresh, service failure and duplicate query values. Navigation makes no checkout or account mutation requests. Identity and licence fixtures are absent from shared HTML.
- An intentional 300ms click-handler block fails the responsiveness guard: the second frame rises to 431ms. The temporal detector identifies the injected defect.
- Gallery progressive rendering, prefetch reuse, keyboard batch loading, block classification and responsive accessibility checks passed.

A counter-layout experiment moved the measured layout cost to another component without a material total improvement. It was reverted. Smooth decreasing and increasing figures remain intact; that experiment is not included as a performance win.

Registry validation, TypeScript and the latest 937-test unit suite passed. The release build and bundle dry-run passed against committed public/private content. Another task had unfinished editorial translations locally, so verification used an archived committed editorial snapshot while preserving those edits. Diagnostic files and private fixtures remain outside the public repository.

## Evidence

Local evidence directory: `/Users/richardawoyemi/ai-prototypes/chit-chat/output/design-route-latency-20261013/`.

Primary files: `routes-live-before.json`, `routes-live-account-final.json`, `feedback-before.json`, `feedback-after.json`, `query-states/`, `query-negative/`, `account-options/`, `account-release-check/` and `routes-negative-final.json`. The six shared scenarios are archived with their baseline, result and negative control under `replays/design-yaps-public-navigation/2026-10-13T02-30-21Z/`. This is the first archived baseline for this case, so there is no earlier stored-run comparison.

Relevant executable checks live in `tests/browser/route-fetch-performance.mjs`, `gallery-query-navigation.mjs`, `navigation-feedback.mjs`, `account-route-options.mjs` and `blocks-pages-probe.mjs`. Keep the extended matrix, its cold blog outlier and the common-case improvement together when discussing the result.
