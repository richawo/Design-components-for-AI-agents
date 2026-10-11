# Component quality audit, 11 October 2026

The review covered **82 recent components**, with source improvements or completed additions in **59**. All 82 pass the final automated browser audit after targeted rechecks. This is evidence of the checks below, not a guarantee that every possible state or integration is defect-free.

## Scope

The repository contains 150 complete components: 58 free and 92 Pro. The recent cohort uses `added >= 2026-10-10`: 25 free and 57 Pro, comprising 81 web components and one React Native component. Static registry validation and TypeScript checks cover the whole catalog; the detailed browser and design review covers this recent cohort.

Seven pending additions were completed and verified: Profile Stats Card, Sortable Data Table, Nested Dropdown Menu, Marquee Screens Hero, Scoped Search Input, Tooltip Group and Agent Run Trace. The incomplete `hero-scroll-zoom` source remains a private draft outside the catalog. Existing unrelated authentication and mobile work was preserved.

The reference review included [21st.dev](https://21st.dev/) and [UIARC](https://uiarc.dev/). The priority was consistent interaction and presentation in the existing catalog. No extra speculative component batch was added after these seven pending additions.

## Findings addressed

- Reliability: empty chart and plan inputs, insufficient nested chart data, custom code files, clipboard rejection, composer failures and stale asynchronous completion.
- Honest integrations: webhook retries await the host callback, display failures and preserve host-owned history. Missing attempts, response data and metrics are represented as missing rather than invented.
- Accessibility: keyboard navigation, appropriate ARIA, hidden focus targets, IME composition, readable light/dark text and larger touch controls.
- Responsive craft: 320 px toolbars, model metrics, deployment controls, approval footers, comment headers and annotation artwork.
- Catalog quality: consistent registry exports and metadata, completed component contracts, refreshed preview assets and uncropped expanded-panel recordings.

## Verification

| Check | Result |
| --- | --- |
| Strict registry generation | Pass, 150 complete components |
| TypeScript | Pass |
| Unit tests | 578 passing across 25 files |
| Browser audit | 82/82 passing after rechecks; 650 viewport measurements and 242 theme/accessibility scans |
| Web widths | 320, 390, 768, 1024, 1440 and 1920 px |
| Native web-preview widths | 360, 390 and 430 px |
| Coarse-pointer layouts | 320 and 390 px; available dark/light themes; requested CSS width asserted |
| Automated accessibility | No remaining reported axe A/AA violations in the audited desktop/theme states |
| Runtime and layout | No remaining captured browser exceptions, duplicate IDs or document overflow in the audited states |
| Reduced motion | No CSS/Web Animations left running in the audited reduced-motion state |
| Empty-data and multiple-instance sweep | 81/81 web components; 157 empty-array cases; no exceptions or duplicate IDs |
| Targeted browser regression suite | 10 scenarios passing, including available Pro cases |
| Metadata controls | 82/82 component checks passed |
| Demo recordings | All 82 exercised; 59 refreshed recordings pass the recorder's size/duration/runtime gates |
| Visual review | Desktop/narrow screenshots, full touch captures for the changed dense layouts, and sampled frames from all 59 refreshed recordings |
| Production build and smoke test | Pass on Node 24.21.0; 82/82 production previews and all 10 interaction suites pass |

The browser audit initially caught a 320 px message-toolbar overflow, which was fixed and rechecked. Its first touch harness also exposed a fallback-viewport issue; the permanent harness now asserts actual CSS width. Full-frame captures avoid hiding content below the iframe. The original evidence remains alongside the final results.

## Repeatable checks

See [Component browser QA](COMPONENT_QA.md) for commands. The repository now includes:

- `npm run audit:components`: screenshots, real touch widths, runtime, accessibility and reduced-motion observations.
- `npm run test:components`: focused behavioral regressions.
- `npm run test:component-data`: empty arrays and multiple instances through real named exports.
- `record-demos.mjs --frame-viewport`: matching video/poster framing for expanding panels.

The full local evidence is in the ignored `test-results/component-quality-20261011/` directory. `final-results.json` combines the full sweep with its successful targeted rechecks and identifies their source reports. `verified-data/results.json`, `final-record-results.json`, `permanent-regressions-final.log`, `controls-results.json`, `production-build.log`, `production-regressions.log`, `production-smoke-results.json`, screenshots and contact sheets retain the supporting detail. Pro source remains in its private repository.

## Coverage limits

The browser run used Chromium. It does not replace Safari/Firefox coverage, real iOS/Android execution, a screen-reader audit, or integration tests against a consuming application's backend. The React Native component was exercised through its web preview. Axe and the animation check cover the observed states; they do not prove complete WCAG conformance or every timer/canvas animation path. Arbitrary nested application data requires dedicated schema-specific tests beyond the documented empty-array sweep.

## Component results

Every row passed the final browser audit. “No source change required” means the reviewed checks found no actionable issue; it is not an assertion of perfection.

| Component | Tier | Audit | Change or finding |
| --- | --- | --- | --- |
| `agent-approval-gate` | pro | Pass | Readable details, larger touch controls and a stacked narrow footer. |
| `agent-commit-card` | pro | Pass | Readable success text in light mode and larger touch controls. |
| `agent-diff-review` | pro | Pass | Empty data, keyboard-accessible scrolling, contrast and touch controls. |
| `agent-plan-steps` | pro | Pass | Preserve IME composition while editing steps. |
| `agent-run-trace` | pro | Pass | Complete pending component; accessible trace inspection, larger ruler/close targets and a shorter demo. |
| `agent-status-pill` | free | Pass | Readable labels in both themes; full themed demo; pause the clock while hidden. |
| `agent-tool-call` | pro | Pass | Readable row numbers and larger touch actions. |
| `ai-citations-inline` | pro | Pass | No source change required by the reviewed checks. |
| `ai-composer-minimal` | free | Pass | Preserve drafts on sync/async failures; ignore stale completion after Stop or a newer draft. |
| `ai-image-generation` | pro | Pass | No source change required by the reviewed checks. |
| `ai-mcp-elicitation` | pro | Pass | No source change required by the reviewed checks. |
| `ai-message-actions` | free | Pass | Wrap the action toolbar at 320 px and retain full touch targets. |
| `ai-model-picker` | pro | Pass | Stack metrics on narrow screens and improve metadata contrast. |
| `ai-reasoning-trace` | pro | Pass | No source change required by the reviewed checks. |
| `ai-search-answer` | pro | Pass | Increase the touch area of source controls. |
| `ai-side-panel` | pro | Pass | No source change required by the reviewed checks. |
| `ai-thinking-states` | free | Pass | No source change required by the reviewed checks. |
| `ai-voice-mode` | pro | Pass | No source change required by the reviewed checks. |
| `bg-dither-flow` | pro | Pass | No source change required by the reviewed checks. |
| `bg-grain-gradient` | pro | Pass | No source change required by the reviewed checks. |
| `billing-cancel-flow` | pro | Pass | No source change required by the reviewed checks. |
| `billing-invoice-list` | free | Pass | Enlarge touch controls. |
| `billing-overview` | pro | Pass | Fit payment metadata on narrow screens; frame expanded demo panels fully. |
| `billing-payment-methods` | free | Pass | Enlarge touch controls; keep expanded demo states inside the recording. |
| `billing-plan-change` | pro | Pass | Handle an empty plan list and enlarge touch controls. |
| `billing-seat-manager` | pro | Pass | No source change required by the reviewed checks. |
| `billing-usage-forecast` | pro | Pass | No source change required by the reviewed checks. |
| `button-magnetic` | pro | Pass | No source change required by the reviewed checks. |
| `button-press-depth` | free | Pass | No source change required by the reviewed checks. |
| `card-profile-stats` | free | Pass | Complete pending component; readable metadata and honest controlled follow state. |
| `chart-cohort-retention` | pro | Pass | Empty nested cohorts, data recovery, keyboard selection, narrow controls and contrast. |
| `chart-race-bars` | pro | Pass | Improve labels and chart contrast. |
| `chart-radar-compare` | pro | Pass | Guard insufficient/empty axes and improve labels and grid contrast. |
| `chart-streamgraph` | pro | Pass | Improve chart label contrast. |
| `chart-treemap-drill` | pro | Pass | Readable values and changes in both themes. |
| `chart-waffle` | free | Pass | Empty, zero, invalid and extreme values; recovery; readable labels and accessible period controls. |
| `collab-activity-feed` | pro | Pass | Readable deleted text and larger touch filters. |
| `collab-annotation-pins` | pro | Pass | Fit narrow artwork; enlarge pin targets; preserve IME input. |
| `collab-comment-thread` | pro | Pass | Readable editing controls, IME input, touch targets and a coherent narrow header. |
| `collab-invite-people` | pro | Pass | Preserve IME input and enlarge touch controls. |
| `collab-mention-input` | free | Pass | Correct ARIA and preserve IME Enter. |
| `collab-presence-bar` | free | Pass | Improve idle-avatar legibility. |
| `collab-share-access` | pro | Pass | Preserve IME input and enlarge touch controls. |
| `combobox-async` | pro | Pass | Improve label contrast and preserve IME input. |
| `data-table-sortable` | free | Pass | Complete pending component; custom columns, sorting, selection and empty-column handling. |
| `devtools-api-playground` | pro | Pass | Readable inactive parameters; larger tab and checkbox targets. |
| `devtools-code-block` | free | Pass | Typed custom files, empty-file recovery, keyboard tabs and truthful clipboard failures. |
| `devtools-env-vars` | pro | Pass | Preserve IME input; frame the expanded import panel fully. |
| `devtools-feature-flags` | pro | Pass | Improve metadata contrast on raised rows. |
| `devtools-log-stream` | pro | Pass | Improve filter-count contrast and touch controls. |
| `devtools-status-page` | pro | Pass | No source change required by the reviewed checks. |
| `devtools-webhook-inspector` | pro | Pass | Host-backed retries and errors, no fabricated attempts/metrics, empty-state handling and keyboard semantics. |
| `diagram-agent-loop` | pro | Pass | Readable goal status and larger touch replay. |
| `diagram-deploy-canary` | pro | Pass | Wrap mobile actions, preserve stage labels and support radio-group arrow keys. |
| `diagram-payment-hops` | pro | Pass | Guard insufficient hop data. |
| `diagram-rag-pipeline` | pro | Pass | Enlarge touch controls. |
| `diagram-region-failover` | pro | Pass | Enlarge touch controls. |
| `diagram-sequence-auth` | pro | Pass | Enlarge touch controls. |
| `diagram-vector-space` | pro | Pass | Enlarge touch controls. |
| `dialog-confirm-typed` | free | Pass | Do not submit during IME composition. |
| `dropdown-menu-nested` | free | Pass | Complete pending component; activate the actually focused row and synchronize focus. |
| `editor-markdown-split` | pro | Pass | No source change required by the reviewed checks. |
| `editor-node-graph` | pro | Pass | Readable node details and warning states. |
| `editor-rich-text` | pro | Pass | Readable light-theme note labels and IME-safe input. |
| `editor-signature-pad` | pro | Pass | No source change required by the reviewed checks. |
| `editor-whiteboard` | pro | Pass | No source change required by the reviewed checks. |
| `effect-gravity-grid` | pro | Pass | No source change required by the reviewed checks. |
| `feedback-morph-loader` | free | Pass | Improve faint copy and touch targets. |
| `hero-ghost-cursor` | pro | Pass | No source change required by the reviewed checks. |
| `hero-inline-objects` | pro | Pass | No source change required by the reviewed checks. |
| `hero-marquee-screens` | free | Pass | Complete pending component; readable interface artwork and motion controls. |
| `input-floating-label` | free | Pass | No source change required by the reviewed checks. |
| `input-search-scoped` | free | Pass | Complete pending component; parse pasted scopes and preserve IME input. |
| `mobile-agent-approval` | pro | Pass | Remove hidden receipt controls from the focus path; verify defer/reopen. |
| `multiselect-chips` | pro | Pass | Readable region codes, IME-safe input and larger overflow control. |
| `segmented-control` | free | Pass | Readable selected counts and larger touch controls. |
| `select-listbox` | free | Pass | Theme the full demo stage and preserve IME input. |
| `switch-spring` | free | Pass | No source change required by the reviewed checks. |
| `tabs-underline-glide` | free | Pass | Fit narrow statistics and improve contrast. |
| `toast-promise` | free | Pass | Readable demo timestamps and larger touch controls. |
| `tooltip-group` | free | Pass | Complete pending component; readable hints and a wrapping touch toolbar. |
| `usage-meter-tokens` | pro | Pass | Remove the hidden thumb from focus and enlarge the touch slider. |
