# Individual component loading, 17 October 2026

The reported slow path was the journey from a real catalogue card to a usable
live preview on an individual component page. Measuring only the heading or
iframe element missed most of the wait. A production replay reached 22 seconds
for the chart preview and saw background prefetch responses with status 503.
The user's browser also contained a Cloudflare 1105 error document inside the
mobile preview (Ray `a4c169ccec6953a3`, 18:37:23 UTC). The parent kept spinning.

## Changes and boundaries

- Pack generated source bundles with gzip/base64 and decode only a requested
  source. The 359-component registry falls from 19,622,141 to 7,704,494 bytes.
  Tests verify exact source and prompt preservation and licensed downloads.
- Preserve the lazy import between the public Cloudflare router and the Next
  server. A normal Wrangler bundle folds that boundary together. The prepared
  router is 2,655,576 bytes; the separate server is 47,391,109 bytes. Total
  runtime modules are 55,491,684 bytes, below the enforced 64 MiB limit.
  Gzipped source maps total 4,487,233 bytes, below the 15 MB guard.
- Give fingerprinted `/_next/static/*` files immutable browser caching. The
  default asset policy revalidated scripts shared by the page and its iframe.
  Stable paths, HTML, build markers and private APIs retain their policies.
- Reset preview state when the slug changes. Detect failed iframe documents
  both on load and after parent hydration. Retry a failed GET once, then offer
  manual retry; a 15-second handshake deadline also handles stalled scripts.
  Failed frames remain outside keyboard focus until ready.

Two attempted preview rewrites were rejected. Passing a component selected from
a shared server import map preloaded 81 scripts for a chart, including unrelated
native and 3D code. Server-rendering each demo through isolated routes grew the
prepared server to 87 MiB and total modules to 100,124,025 bytes. The size guard
rejected it before deployment. The shipped preview loader retains selected lazy
client imports.

## Comparable replay

The baseline uses immutable public commit `867c9a7` and private commit `973961b`.
The patched build applies only these fixes to those sources, excluding concurrent
component edits. Both runs use the same real search, card, one-second dwell,
1440 x 900 viewport, Chromium default renderer, 5 Mbps, 80 ms network latency
and 4x CPU slowdown. Warm visits reload the catalogue document while retaining
HTTP caches; the separate history replay checks back/forward behaviour.

| Visible preview after click | Before | After |
| --- | ---: | ---: |
| Portfolio Chart, first visit | 10,010 ms | 1,186 ms |
| Portfolio Chart, warm visit | 1,523 ms | 490 ms |
| Budget Envelope, first visit | 6,591 ms | 2,417 ms |
| Budget Envelope, warm visit | 1,863 ms | 581 ms |

| Maximum across those visits | Before | After |
| --- | ---: | ---: |
| First click animation frame | 129 ms | 58 ms |
| Second click animation frame | 145 ms | 62 ms |
| Destination shell | 2,728 ms | 335 ms |
| Long task | 287 ms | 137 ms |

The baseline reproduces the issue and fails the 2.5-second preview budget. The
patched replay passes, with 11 scripts per preview and no hydration errors or
failed responses. A separate Route Globe replay passes at 1,792 ms on first
visit, with a 124 ms maximum long task. It has no matching pre-change sample,
so it establishes a current guard rather than a measured 3D speedup.

The 300 ms blocking-click negative control fails as intended: first/second
frames reach 353/359 ms and the maximum long task reaches 332 ms. Readiness and
animation frames are browser proxies, not physical display or field INP
measurements. The shared development machine and short samples limit precision.

The before/after/negative archive is
`test-results/frontend-latency-replays/design-component-open/2026-10-17T19-36-50Z/`.
This is the first archive for this exact full-preview case, so there is no prior
archived after-run to compare. Additional reports and inspected desktop/mobile
screenshots are in `test-results/component-navigation/`. Generated evidence
stays ignored by Git.

## Recovery and release checks

The browser recovery replay passes all three cases at 390 px: a transient 503
recovers automatically, a persistent 503 stops after two requests and recovers
on manual retry, and a document whose JavaScript never announces readiness
times out and recovers on manual retry. There is no automatic retry loop.

Strict registry validation, TypeScript and all 1,049 unit tests pass. The final
prepared `--no-bundle` Worker serves public component pages and previews as cache
hits. Anonymous Pro source stays locked with private/no-store caching; registry
and install endpoints return 401 with no-store. Unknown preview slugs return
404. Both bundle budgets and browser replays are required by `AGENTS.md`, with
the same guidance referenced from `CLAUDE.md`.

Reducing startup work and recovering failed frames addresses application-side
contributors and the indefinite spinner. Healthy request execution samples were
much shorter than the external waits, but historical Cloudflare error analytics
were unavailable to this session. The platform-side cause of the observed 1105
cannot be established from these samples alone.

## Production verification

The live marker confirms public `0044a0a` and private `d12bdee`, including all
runtime fixes through `5ee6c46`. The same throttled catalogue-to-preview replay
passes on production with 11 scripts per preview, no failed responses and no
hydration errors:

| Production visible preview | Before | After |
| --- | ---: | ---: |
| Portfolio Chart, first visit | 22,018 ms | 1,375 ms |
| Portfolio Chart, warm visit | 12,909 ms | 496 ms |
| Budget Envelope, first visit | 10,846 ms | 1,706 ms |
| Budget Envelope, warm visit | 8,792 ms | 639 ms |

Maximum first/second click frames move from 112/128 to 74/77 ms, and maximum
long tasks from 339 to 137 ms. Production also passes the transient, persistent
and stalled-preview recovery replay, with failures injected in the test browser
only. Public pages and previews return cache hits, fingerprinted assets have
immutable caching, and anonymous Pro source/install requests retain their
locked or 401 responses and no-store policies.

An earlier production after-run reached 2,633 ms and missed the local budget.
The development machine then ran out of disk space and blocked subsequent
checks. After removing only disposable build output, the clean repeat passed
without application changes. Both reports are retained; this is not a claim
that every production visit is below 2.5 seconds. Production sources also
include concurrent component updates, so the immutable local comparison above
provides the controlled attribution. Its source provenance was checked against
498 public and 863 private source files.

The replay archive also contains the production before/after reports, the
earlier after-run, source provenance and the live smoke result. Later commits
to this report do not alter application behaviour.

```sh
PERF_BASE=http://127.0.0.1:4189 PERF_SLUGS=chart-portfolio,mobile-budget-envelope PERF_ASSERT=1 node tests/browser/component-navigation-performance.mjs
TEST_BASE=http://127.0.0.1:4189 node tests/browser/preview-recovery.mjs
```

Use `npm run deploy:dry-run`, then serve `.open-next/deploy/worker.js` with
`wrangler dev --no-bundle` before these checks. See [DEPLOY.md](DEPLOY.md) for
live build-marker and authorization verification.
