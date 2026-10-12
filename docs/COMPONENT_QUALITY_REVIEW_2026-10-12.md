# Catalogue quality review, 12 October 2026

This review covers the full 243-component catalogue: 68 free and 175 Pro. It follows the release of 50 industry and SaaS workflows and six scroll components. The task was to improve the existing offering, with particular attention to the Sprintboard, Audit Trail Explorer and recently added Pro suites.

## Changes

- Rebuilt Sprintboard interaction: pointer, touch and keyboard dragging, cross-column movement, reordering, column creation, renaming and removal, task preservation and atomic controlled-state callbacks.
- Refined Audit Trail Explorer around a neutral timeline, readable typography, animated filters and detail changes, measured date-panel expansion, correct timestamp ordering, and custom or native dropdowns.
- Applied monochrome styling, stronger hierarchy, intentional spacing, readable secondary text and restrained transitions across the recent commerce, fashion, finance, HR, legal and SaaS suites. Kept colour where it communicates an error, status or data series.
- Added balanced dropdown insets, accessible custom menus and a documented native option. Covered viewport containment, keyboard navigation, disabled options and focus restoration.
- Replaced abrupt workflow changes with keyed entrances and exits. Animated measured height without stretching text and made outgoing content inert.
- Corrected empty-data failures in locale lists, matrix scenes and chart configurations. Fixed unavailable or zero-baseline chart comparisons and clipped an animated revenue path during viewport resizing.
- Repaired microphone cleanup, duplicate toast identifiers, mobile control semantics, slider keyboard actions, hidden wallet controls and terminal keyboard scrolling.
- Made live and recorded demos follow usable targets through transitions. Missing targets no longer cause a click at the previous cursor position. Replay tests read the published metadata directly.

## Verification

The review changed 107 component sources: 84 Pro and 23 free. It also corrected the shared demo player and recorder. The catalogue remains 243 components (175 Pro and 68 free); this pass focused on quality rather than expanding the count.

| Check | Result | Coverage |
| --- | --- | --- |
| Strict registry validation | Pass | Metadata, standalone structure and catalogue integrity |
| TypeScript | Pass | `npm run typecheck` |
| Unit tests | 732/732 | 30 test files, including a run with the default test timeout |
| Production build | Pass | Isolated optimized Next build, 1,132 generated pages |
| Catalogue browser audit | 243/243 after fixes and rechecks | Runtime errors, overflow, duplicate IDs, automated accessibility and reduced motion |
| Empty data and multiple instances | 230/230 web components | 468 empty-array cases and duplicate-ID checks |
| New industry and SaaS workflows | 50/50 | Task-specific interactions, validation, callback payloads and failure recovery |
| Live demo replay | 50/50 | Actual metadata steps; eight affected workflows additionally assert their intended final state |
| Custom/native selectors | 34/34 in Chromium and WebKit | Both themes, 320/390px widths, equal insets, viewport containment, Home/End and Escape/focus restoration |
| New scroll patterns | 6/6 in Chromium and WebKit | Progress, reversal and reduced-motion behaviour |
| WebKit rendering | 56/56 additions | Desktop and phone previews, runtime errors and overflow |
| Local production access/discovery | 506 checks | The 56 additions remain Pro; anonymous source routes stay locked and previews remain available |
| Local production phone previews | 56/56 | Chromium at 320px |

All 243 components received a source pass and visual overview. Changed components received targeted screenshot and interaction review. The full audit uses six web widths (320, 390, 768, 1024, 1440 and 1920px), three mobile-preview widths (360, 390 and 430px), coarse-pointer layouts and the supported theme variants. Refreshed workflow recordings were inspected for meaningful end states, including the actual final frame when a contact sheet ended mid-transition.

The original full audit returned 241/243. `hero-terminal-agent` exposed an unfocusable scroll region; its log is now keyboard focusable and a keyboard regression passes. `billing-payment-methods` was sampled during a short opacity transition; its unchanged follow-up passed. Those original results remain preserved. Twelve workflow state-transition changes were audited again on the final production build before their results were merged into the 243-component result.

The first full browser-suite run also exposed three harness problems: a copied replay script had drifted from metadata, a date expansion was sampled at a fixed delay, and a spring reversal was checked before settling under load. The replay now reads metadata, the expansion collects animation-frame samples, and the reversal has a bounded wait for the exact end state. Their targeted reruns pass. These results do not rewrite the earlier failure logs.

Additional focused regressions cover real CDP touch dragging, keyboard and pointer board movement, column management, asynchronous microphone cleanup, missing and zero chart baselines, invalid allocation data, empty-to-populated recovery, terminal scrolling, and delayed, moving, inert, missing or cancelled demo targets.

## Reproducing the checks

Run from the public repository with the authorized private Pro checkout available. Start the preview server separately and use its actual address in place of port 3122.

```sh
node scripts/build-registry.mjs --strict
npm run typecheck
npm test -- --maxWorkers=2
PREVIEW_BASE=http://localhost:3122 npm run test:components
node scripts/audit-components.mjs --base=http://localhost:3122
PREVIEW_BASE=http://localhost:3122 node scripts/test-component-data.mjs
PREVIEW_BASE=http://localhost:3122 BROWSER=webkit node tests/browser/pro-select-polish-probe.mjs
PREVIEW_BASE=http://localhost:3122 SCROLL_BROWSER=webkit node tests/browser/pro-scroll-probe.mjs
```

Evidence is retained locally under `test-results/catalogue-review-20261012/` and the adjacent `catalogue-review-*.log` files. The evidence includes `final-audit/audit.json` (original result), `final-rechecked/` and `fixed/` (follow-ups), `consolidated-audit.json`, `final-data/results.json`, `webkit-render.json`, `production-release.json`, the isolated build logs, screenshots and video contact sheets. These generated files are deliberately excluded from Git. The committed tests and this report preserve the repeatable checks and their recorded outcome.

Source changes were counted from the review's public baseline `63b06af^` and private baseline `98ceb25^`, restricted to component TSX files. Unrelated site changes and pre-existing local work are excluded from the component count.

## Component coverage

Every row passed the final consolidated browser audit. "Retained" means reviewed without a component-source change in this pass. Mobile rows refer to React Native web previews; their physical-device coverage is explicitly bounded below.

| Component | Tier | Platform | Source | Audit |
| --- | --- | --- | --- | --- |
| `agent-approval-gate` | Pro | web | Retained | Pass |
| `agent-commit-card` | Pro | web | Retained | Pass |
| `agent-diff-review` | Pro | web | Retained | Pass |
| `agent-plan-steps` | Pro | web | Retained | Pass |
| `agent-run-trace` | Pro | web | Retained | Pass |
| `agent-status-pill` | Free | web | Retained | Pass |
| `agent-tool-call` | Pro | web | Retained | Pass |
| `ai-citations-inline` | Pro | web | Retained | Pass |
| `ai-composer-minimal` | Free | web | Retained | Pass |
| `ai-image-generation` | Pro | web | Retained | Pass |
| `ai-mcp-elicitation` | Pro | web | Retained | Pass |
| `ai-message-actions` | Free | web | Retained | Pass |
| `ai-model-picker` | Pro | web | Retained | Pass |
| `ai-reasoning-trace` | Pro | web | Updated | Pass |
| `ai-search-answer` | Pro | web | Retained | Pass |
| `ai-side-panel` | Pro | web | Retained | Pass |
| `ai-thinking-states` | Free | web | Retained | Pass |
| `ai-voice-mode` | Pro | web | Retained | Pass |
| `app-permission-matrix` | Pro | web | Retained | Pass |
| `auth-magic-link` | Free | web | Retained | Pass |
| `auth-otp` | Pro | web | Retained | Pass |
| `auth-passkey` | Free | web | Updated | Pass |
| `auth-sign-in` | Free | web | Updated | Pass |
| `auth-sso-detect` | Pro | web | Updated | Pass |
| `bento-grid` | Pro | web | Retained | Pass |
| `bg-dither-flow` | Pro | web | Retained | Pass |
| `bg-grain-gradient` | Pro | web | Retained | Pass |
| `billing-cancel-flow` | Pro | web | Retained | Pass |
| `billing-invoice-list` | Free | web | Retained | Pass |
| `billing-overview` | Pro | web | Retained | Pass |
| `billing-payment-methods` | Free | web | Retained | Pass |
| `billing-plan-change` | Pro | web | Retained | Pass |
| `billing-seat-manager` | Pro | web | Retained | Pass |
| `billing-usage-forecast` | Pro | web | Retained | Pass |
| `button-hold-confirm` | Free | web | Updated | Pass |
| `button-magnetic` | Pro | web | Retained | Pass |
| `button-press-depth` | Free | web | Retained | Pass |
| `card-profile-stats` | Free | web | Retained | Pass |
| `cards-event-ticket` | Pro | web | Retained | Pass |
| `cart-drawer` | Pro | web | Updated | Pass |
| `chart-allocation` | Pro | web | Updated | Pass |
| `chart-bullet-targets` | Pro | web | Retained | Pass |
| `chart-candlestick` | Pro | web | Updated | Pass |
| `chart-channel-breakdown` | Pro | web | Updated | Pass |
| `chart-cohort-retention` | Pro | web | Retained | Pass |
| `chart-portfolio` | Free | web | Updated | Pass |
| `chart-race-bars` | Pro | web | Retained | Pass |
| `chart-radar-compare` | Pro | web | Retained | Pass |
| `chart-revenue-trend` | Pro | web | Updated | Pass |
| `chart-slope-comparison` | Pro | web | Retained | Pass |
| `chart-streamgraph` | Pro | web | Retained | Pass |
| `chart-treemap-drill` | Pro | web | Retained | Pass |
| `chart-waffle` | Free | web | Retained | Pass |
| `chart-waterfall-bridge` | Pro | web | Retained | Pass |
| `chat-thread` | Free | web | Updated | Pass |
| `collab-activity-feed` | Pro | web | Retained | Pass |
| `collab-annotation-pins` | Pro | web | Retained | Pass |
| `collab-comment-thread` | Pro | web | Retained | Pass |
| `collab-invite-people` | Pro | web | Retained | Pass |
| `collab-mention-input` | Free | web | Retained | Pass |
| `collab-presence-bar` | Free | web | Retained | Pass |
| `collab-share-access` | Pro | web | Retained | Pass |
| `combobox-async` | Pro | web | Retained | Pass |
| `command-palette` | Free | web | Retained | Pass |
| `commerce-backorder-allocation` | Pro | web | Updated | Pass |
| `commerce-bundle-builder` | Pro | web | Updated | Pass |
| `commerce-catalog-import` | Pro | web | Updated | Pass |
| `commerce-customer-timeline` | Pro | web | Updated | Pass |
| `commerce-fulfilment-desk` | Pro | web | Updated | Pass |
| `commerce-operations-dashboard` | Pro | web | Updated | Pass |
| `commerce-promotion-builder` | Pro | web | Updated | Pass |
| `commerce-purchase-order` | Pro | web | Updated | Pass |
| `commerce-return-desk` | Pro | web | Retained | Pass |
| `commerce-shipping-estimator` | Pro | web | Updated | Pass |
| `commerce-variant-stock` | Pro | web | Retained | Pass |
| `content-accordion-index` | Free | web | Retained | Pass |
| `content-release-notes` | Pro | web | Retained | Pass |
| `cta-horizon` | Free | web | Retained | Pass |
| `dashboard-kpi-cards` | Pro | web | Updated | Pass |
| `dashboard-orders-table` | Pro | web | Retained | Pass |
| `data-file-explorer` | Pro | web | Retained | Pass |
| `data-kanban-compact` | Pro | web | Updated | Pass |
| `data-query-builder` | Pro | web | Updated | Pass |
| `data-table-sortable` | Free | web | Retained | Pass |
| `date-booking-slots` | Pro | web | Retained | Pass |
| `date-week-agenda` | Pro | web | Retained | Pass |
| `devtools-api-playground` | Pro | web | Retained | Pass |
| `devtools-code-block` | Free | web | Retained | Pass |
| `devtools-env-vars` | Pro | web | Retained | Pass |
| `devtools-feature-flags` | Pro | web | Retained | Pass |
| `devtools-json-inspector` | Pro | web | Retained | Pass |
| `devtools-log-stream` | Pro | web | Retained | Pass |
| `devtools-request-waterfall` | Pro | web | Retained | Pass |
| `devtools-status-page` | Pro | web | Retained | Pass |
| `devtools-webhook-inspector` | Pro | web | Retained | Pass |
| `diagram-agent-loop` | Pro | web | Retained | Pass |
| `diagram-deploy-canary` | Pro | web | Retained | Pass |
| `diagram-payment-hops` | Pro | web | Retained | Pass |
| `diagram-rag-pipeline` | Pro | web | Retained | Pass |
| `diagram-region-failover` | Pro | web | Retained | Pass |
| `diagram-sequence-auth` | Pro | web | Retained | Pass |
| `diagram-vector-space` | Pro | web | Retained | Pass |
| `dialog-confirm-typed` | Free | web | Retained | Pass |
| `dropdown-menu-nested` | Free | web | Retained | Pass |
| `editor-markdown-split` | Pro | web | Retained | Pass |
| `editor-node-graph` | Pro | web | Retained | Pass |
| `editor-rich-text` | Pro | web | Retained | Pass |
| `editor-signature-pad` | Pro | web | Retained | Pass |
| `editor-whiteboard` | Pro | web | Retained | Pass |
| `effect-gravity-grid` | Pro | web | Retained | Pass |
| `fashion-assortment-planner` | Pro | web | Updated | Pass |
| `fashion-collection-line-plan` | Pro | web | Updated | Pass |
| `fashion-exchange-selector` | Pro | web | Updated | Pass |
| `fashion-launch-calendar` | Pro | web | Updated | Pass |
| `fashion-merchandising-dashboard` | Pro | web | Updated | Pass |
| `fashion-preorder-planner` | Pro | web | Updated | Pass |
| `fashion-size-guide` | Pro | web | Updated | Pass |
| `fashion-wholesale-order` | Pro | web | Updated | Pass |
| `feature-sticky-scroll` | Pro | web | Updated | Pass |
| `feedback-empty-search` | Free | web | Retained | Pass |
| `feedback-inline-alert` | Free | web | Retained | Pass |
| `feedback-morph-loader` | Free | web | Retained | Pass |
| `finance-budget-variance` | Pro | web | Updated | Pass |
| `finance-cashflow-dashboard` | Pro | web | Updated | Pass |
| `finance-close-checklist` | Pro | web | Updated | Pass |
| `finance-expense-review` | Pro | web | Updated | Pass |
| `finance-invoice-composer` | Pro | web | Updated | Pass |
| `finance-payment-run` | Pro | web | Updated | Pass |
| `finance-receivables-aging` | Pro | web | Updated | Pass |
| `finance-reconciliation` | Pro | web | Retained | Pass |
| `finance-scenario-forecast` | Pro | web | Updated | Pass |
| `footer-ascii-wordmark` | Pro | web | Updated | Pass |
| `footer-columns-status` | Free | web | Updated | Pass |
| `footer-newsletter` | Free | web | Updated | Pass |
| `footer-wordmark` | Free | web | Updated | Pass |
| `forms-preference-center` | Pro | web | Retained | Pass |
| `header-announcement` | Free | web | Updated | Pass |
| `header-hairline` | Free | web | Updated | Pass |
| `header-island` | Pro | web | Updated | Pass |
| `header-morph-mega` | Pro | web | Updated | Pass |
| `hero-app-tilt` | Free | web | Updated | Pass |
| `hero-blur-statement` | Free | web | Retained | Pass |
| `hero-ghost-cursor` | Pro | web | Retained | Pass |
| `hero-inline-objects` | Pro | web | Retained | Pass |
| `hero-kinetic-type` | Pro | web | Updated | Pass |
| `hero-marquee-screens` | Free | web | Retained | Pass |
| `hero-prism` | Pro | web | Retained | Pass |
| `hero-product-stack` | Pro | web | Updated | Pass |
| `hero-swiss-grid` | Free | web | Retained | Pass |
| `hero-terminal-agent` | Free | web | Updated | Pass |
| `hr-capacity-planner` | Pro | web | Updated | Pass |
| `hr-compensation-review` | Pro | web | Updated | Pass |
| `hr-employee-onboarding` | Pro | web | Updated | Pass |
| `hr-interview-scorecard` | Pro | web | Updated | Pass |
| `hr-leave-approval` | Pro | web | Updated | Pass |
| `hr-org-explorer` | Pro | web | Updated | Pass |
| `hr-people-dashboard` | Pro | web | Updated | Pass |
| `hr-policy-acknowledgement` | Pro | web | Updated | Pass |
| `hr-shift-coverage` | Pro | web | Updated | Pass |
| `input-ai-prompt` | Pro | web | Updated | Pass |
| `input-color-swatches` | Free | web | Retained | Pass |
| `input-file-dropzone` | Pro | web | Retained | Pass |
| `input-floating-label` | Free | web | Retained | Pass |
| `input-number-stepper` | Free | web | Retained | Pass |
| `input-password-checklist` | Free | web | Retained | Pass |
| `input-search-scoped` | Free | web | Retained | Pass |
| `input-shortcut-recorder` | Pro | web | Retained | Pass |
| `input-tag-editor` | Free | web | Retained | Pass |
| `legal-clause-library` | Pro | web | Updated | Pass |
| `legal-document-requests` | Pro | web | Updated | Pass |
| `legal-evidence-index` | Pro | web | Updated | Pass |
| `legal-matter-dashboard` | Pro | web | Updated | Pass |
| `legal-matter-intake` | Pro | web | Updated | Pass |
| `legal-obligation-tracker` | Pro | web | Updated | Pass |
| `legal-renewal-planner` | Pro | web | Updated | Pass |
| `legal-signature-request` | Pro | web | Updated | Pass |
| `legal-version-history` | Pro | web | Retained | Pass |
| `media-before-after` | Pro | web | Retained | Pass |
| `media-story-deck` | Pro | web | Retained | Pass |
| `mobile-agent-approval` | Pro | mobile | Retained | Pass |
| `mobile-bottom-sheet` | Pro | mobile | Updated | Pass |
| `mobile-chat` | Pro | mobile | Retained | Pass |
| `mobile-checkout-sheet` | Pro | mobile | Updated | Pass |
| `mobile-health-summary` | Free | mobile | Updated | Pass |
| `mobile-live-activity` | Pro | mobile | Updated | Pass |
| `mobile-now-playing` | Pro | mobile | Updated | Pass |
| `mobile-onboarding` | Free | mobile | Updated | Pass |
| `mobile-paywall` | Pro | mobile | Updated | Pass |
| `mobile-settings` | Free | mobile | Updated | Pass |
| `mobile-swipe-list` | Pro | mobile | Retained | Pass |
| `mobile-tab-bar` | Free | mobile | Updated | Pass |
| `mobile-wallet-stack` | Pro | mobile | Updated | Pass |
| `multiselect-chips` | Pro | web | Retained | Pass |
| `navbar-floating` | Free | web | Updated | Pass |
| `navigation-breadcrumb-fold` | Free | web | Retained | Pass |
| `navigation-pagination-window` | Free | web | Retained | Pass |
| `onboarding-setup-checklist` | Pro | web | Retained | Pass |
| `pixel-agent-status` | Free | web | Updated | Pass |
| `pixel-matrix-display` | Free | web | Updated | Pass |
| `pricing-comparison-matrix` | Pro | web | Updated | Pass |
| `pricing-plan-toggle` | Free | web | Updated | Pass |
| `pricing-receipt` | Pro | web | Updated | Pass |
| `pricing-three-tier` | Free | web | Updated | Pass |
| `primitives-shortcut-reference` | Free | web | Retained | Pass |
| `progress-milestones` | Free | web | Retained | Pass |
| `saas-access-requests` | Pro | web | Updated | Pass |
| `saas-audit-trail` | Pro | web | Updated | Pass |
| `saas-customer-health` | Pro | web | Updated | Pass |
| `saas-integration-manager` | Pro | web | Updated | Pass |
| `saas-notification-inbox` | Pro | web | Updated | Pass |
| `saas-report-scheduler` | Pro | web | Updated | Pass |
| `saas-saved-views` | Pro | web | Updated | Pass |
| `saas-support-triage` | Pro | web | Updated | Pass |
| `saas-usage-policy` | Pro | web | Updated | Pass |
| `saas-workspace-dashboard` | Pro | web | Updated | Pass |
| `scroll-background-wipe` | Pro | web | Retained | Pass |
| `scroll-chapter-stack` | Pro | web | Retained | Pass |
| `scroll-cinema-frame` | Pro | web | Retained | Pass |
| `scroll-expanding-mosaic` | Pro | web | Retained | Pass |
| `scroll-horizontal-showcase` | Pro | web | Retained | Pass |
| `scroll-image-curtain` | Pro | web | Retained | Pass |
| `segmented-control` | Free | web | Retained | Pass |
| `select-listbox` | Free | web | Retained | Pass |
| `selects-radio-cards` | Free | web | Retained | Pass |
| `settings-panel` | Free | web | Retained | Pass |
| `streaming-text` | Free | web | Retained | Pass |
| `switch-spring` | Free | web | Retained | Pass |
| `tabs-underline-glide` | Free | web | Retained | Pass |
| `testimonial-wall` | Free | web | Retained | Pass |
| `text-decode` | Pro | web | Updated | Pass |
| `three-ascii-object` | Pro | web | Updated | Pass |
| `three-contour-terrain` | Pro | web | Retained | Pass |
| `three-globe-arcs` | Pro | web | Updated | Pass |
| `three-holo-card` | Pro | web | Retained | Pass |
| `three-keycaps` | Pro | web | Updated | Pass |
| `three-particle-sphere` | Pro | web | Updated | Pass |
| `three-voice-orb` | Pro | web | Updated | Pass |
| `three-wave-field` | Free | web | Retained | Pass |
| `toast-promise` | Free | web | Updated | Pass |
| `toast-stack` | Free | web | Updated | Pass |
| `tooltip-group` | Free | web | Retained | Pass |
| `usage-meter-tokens` | Pro | web | Retained | Pass |
| `work-index-hover` | Pro | web | Updated | Pass |

## Scope of the evidence

The review combines source inspection, visual review, browser interaction checks and automated accessibility rules. Automated accessibility results are not a claim of complete WCAG certification. React Native components were verified through their web previews, including keyboard and accessibility semantics; this pass did not exercise physical iOS or Android devices or a screen reader.

The repository's existing four-file, standalone-component and private-source boundaries remain in force. Unrelated local work was preserved. Commits were kept component-sized and pushed to the existing main branches.
