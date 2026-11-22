# Public router manifest capacity, 22 November 2026

OpenNext embeds the full prerender routing manifest in its public middleware.
With 88 guides in 30 languages, the final public entry reached 4,190,479 bytes:
only 3,825 bytes below the existing 4 MiB guard. A routing-only control adding
150 placeholder article records reproduced a guard failure before any new
article was commissioned.

Deployment preparation now packs that generated manifest as compressed JSON.
It parses the named declaration without evaluating surrounding code, verifies
all data against the current Next build, and checks the full compression round
trip and property order. The middleware decodes the manifest once at module
initialization. All 4,362 prerendered routes, 19 dynamic-route records, cache
metadata, fallbacks and preview fields remain intact.

Only the generated data expression changes. The original generated middleware
is retained, and a compact derivative in the same directory preserves relative
imports. The separate Next server remains lazy. Unexpected declarations,
non-data expressions, helper-name collisions and mismatched manifests stop
preparation. Existing entry, total-runtime and source-map limits remain unchanged.

## Prepared package comparison

The baseline uses public `b8f50c769884b1a49d1d2ceb660cd29f337f44df`
and the exact approved private source
`967e9ebc021d27c77f09f531f68617f806fc84b4`. Candidate results below use
the same compiled application and assets with this change to preparation.
The final committed build and actual production release are separate checks.

| Prepared artifact | Baseline | Packed candidate |
| --- | ---: | ---: |
| Public entry, bytes | 4,190,479 | 1,956,770 |
| Entry headroom, bytes | 3,825 | 2,237,534 |
| Total runtime modules, bytes | 61,862,767 | 59,629,058 |
| Gzipped source maps, bytes | 2,249,996 | 2,231,052 |

The current manifest contains 2,505,122 bytes of JSON data and packs to
135,192 encoded bytes. Source-map compaction recognizes the generated compact
middleware while preserving all mappings and ordinary application source.
Generated bundles and raw browser request timelines stay outside Git.

The growth control copies existing article-route metadata shapes into five
placeholder paths per locale. It creates no article source, translation,
reservation, published page or production deployment.

| Routing-only growth control | Unpacked | Packed |
| --- | ---: | ---: |
| Routes | 4,512 | 4,512 |
| Public entry, bytes | 4,263,698 | 1,958,015 |
| Same 4 MiB entry guard | Fails | Passes |

This verifies routing-index headroom. An actual later content batch still needs
its complete build and all other unchanged size and publication checks.

## Navigation and behavioural checks

Both prepared packages use Chromium at 1440 by 900, fourfold CPU slowdown,
80 ms network latency and 5 Mbps download throughput. The same real catalogue
search and card click open Portfolio Chart, Route Globe and Glass Settings on
first and warm visits. No substitute links are inserted.

| Maximum across six visits | Baseline | Packed candidate |
| --- | ---: | ---: |
| First click frame, ms | 41.4 | 40.2 |
| Second click frame, ms | 44.8 | 44.0 |
| Mounted visible preview and next frame, ms | 1,649.1 | 1,480.0 |
| Long task, ms | 99 | 96 |
| Scripts per preview | 12 | 12 |

Both pass the existing 2.5-second preview, 200 ms second-frame and 24-script
guards, with no observed failed requests or hydration errors. These short
shared-machine samples establish compatibility with the measured interaction;
they do not establish a general latency improvement. The preview measurement
is a visible mounted-frame proxy, not physical screen presentation or completion
of a component's entrance animation. Separate screenshots after a 3.2-second
settle show the actual chart, globe and native-web example.

The candidate's 300 ms blocking-click negative control fails as required:
340.1/344.7 ms first/second frames and a 321 ms maximum long task.
Transient, persistent and stalled-preview recovery checks pass. Styled and
Original recordings decode motion, switch matched media, unload offscreen and
retain guest, reduced-motion and navigation behaviour using a local-only fixture
licence. This is a browser rendering check, not a physical native-device test.

Seventeen additional observations verify four article locales, exact Markdown
and content negotiation, public cache hits, immutable fingerprinted assets,
three component/preview pairs, anonymous Pro source and registry guards, an
unknown preview and the unchanged analytics endpoint. No purchase, account or
production credential mutation is involved. Source/locales, strict generation,
TypeScript and all 2,132 tests pass for the candidate.

The first archive for this case is
`test-results/frontend-latency-replays/design-router-manifest-pack/2026-11-22T07-41-21Z/`.
It contains before, after and negative reports, source identities, working-file
hashes, current screenshots, growth controls and boundary observations. There
is no prior after-run for this exact case. Historical component-opening reports
use different sources and catalogue sizes and are not a controlled comparison.

Local checks do not establish production delivery or eliminate the historical
intermittent Cloudflare errors. Confirm the exact successful build and live
marker, then replay production navigation and source/cache boundaries before
recording the capacity repair as delivered.
