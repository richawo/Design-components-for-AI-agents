# Review status

153 components are rebuilt (or, for a few, polished), verified and committed. For each: whether its demo video
needs re-recording, whether its poster is current, and the state of its browser regression probe.

- **Video**: `new` means `public/previews/<slug>.mp4` still shows the old version. Re-record serially on a quiet machine:
  `node scripts/record-demos.mjs <slug> --isolated-source`.
- **Poster**: `stale` means retake it with `node scripts/screenshot.mjs <slug>` (the preview server was overloaded).
- **Probe**: the `tests/browser/pro-50/<slug>.mjs` state, or another probe that covers it. Blank means no browser test
  was written in this review; those are the ones for a separate pass.

## Mobile (20)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `mobile-attachment-tray` | new | current | review-mobile-probe passes with source fixtures; web accessibility state fixed |
| `mobile-budget-envelope` | new | current | review-mobile-probe passes with source fixtures; web accessibility state fixed |
| `mobile-channel-thread` | new | current | review-mobile-probe passes with source fixtures; web accessibility state fixed |
| `mobile-day-planner` | current | current |  |
| `mobile-file-preview` | current | current |  |
| `mobile-focus-session` | new | current | review-mobile-probe passes with source fixtures; web accessibility state fixed |
| `mobile-habit-grid` | current | current |  |
| `mobile-journal-prompt` | current | current |  |
| `mobile-meeting-preflight` | current | current |  |
| `mobile-mood-map` | current | current |  |
| `mobile-notification-digest` | current | current |  |
| `mobile-offline-outbox` | current | current |  |
| `mobile-packing-list` | current | current |  |
| `mobile-project-switcher` | current | current |  |
| `mobile-reading-progress` | current | current |  |
| `mobile-review-annotations` | current | current |  |
| `mobile-sync-conflict` | current | current |  |
| `mobile-task-move` | current | current |  |
| `mobile-trip-itinerary` | current | current |  |
| `mobile-voice-memo` | current | current |  |

## Data and charts (10)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `chart-box-distribution` | new | current |  |
| `chart-calendar-heatmap` | new | current |  |
| `chart-funnel-dots` | new | current |  |
| `chart-sankey-paths` | new | current |  |
| `chart-scatter-brush` | new | current |  |
| `chart-sunburst-explorer` | new | current |  |
| `data-bulk-action-review` | new | current |  |
| `data-column-workbench` | new | current |  |
| `data-filter-history` | new | current |  |
| `data-pivot-configurator` | new | current |  |

## Editors and 3D (12)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `editor-asset-license-sheet` | new | current |  |
| `editor-branch-compare` | new | current |  |
| `editor-color-token-studio` | new | current |  |
| `editor-export-preset` | new | current |  |
| `editor-font-pairing` | new | current |  |
| `editor-keyframe-track` | new | current |  |
| `editor-layer-stack` | new | current |  |
| `editor-spacing-inspector` | new | current |  |
| `editor-storyboard-strip` | new | current |  |
| `editor-version-restore` | new | current |  |
| `three-exploded-assembly` | new | current |  |
| `three-material-inspector` | new | current |  |

## Devtools, agents and AI (12)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `agents-budget-guard` | new | current |  |
| `agents-dependency-board` | new | current |  |
| `agents-run-replay` | new | current |  |
| `ai-answer-compare` | new | current |  |
| `ai-context-budget` | new | current |  |
| `ai-structured-output` | new | current |  |
| `auth-recovery-codes` | new | current |  |
| `devtools-icon-workbench` | new | current |  |
| `devtools-incident-timeline` | new | current |  |
| `devtools-release-compare` | new | current |  |
| `devtools-request-replay` | new | current |  |
| `devtools-schema-migration` | new | current |  |

## Inputs, forms, dates and selects (10)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `date-range-calendar` | new | current |  |
| `date-timezone-overlap` | new | current |  |
| `forms-branching-survey` | new | current |  |
| `forms-draft-rescue` | new | current |  |
| `input-cron-builder` | new | current |  |
| `input-detent-dial` | new | current |  |
| `input-dual-range` | new | current |  |
| `input-expression-editor` | new | current |  |
| `input-unit-converter` | new | current |  |
| `selects-tree-picker` | new | current |  |

## SaaS suite (10)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `saas-access-requests` | new | stale | rewritten, passes |
| `saas-audit-trail` | new | stale | rewritten, passes |
| `saas-customer-health` | new | current | rewritten, passes (invalid dates and empty trends fixed) |
| `saas-integration-manager` | new | current | rewritten, passes |
| `saas-notification-inbox` | new | stale | rewritten, passes |
| `saas-report-scheduler` | new | current | rewritten, passes |
| `saas-saved-views` | new | current | rewritten, passes |
| `saas-support-triage` | new | current | rewritten, passes against Next; pending/rejected undo, exiting controls and invalid timestamps fixed |
| `saas-usage-policy` | new | current | rewritten, passes (warning thresholds and empty usage fixed) |
| `saas-workspace-dashboard` | new | stale | rewritten, passes |

## Legal suite (8)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `legal-clause-library` | new | current | rewritten, passes |
| `legal-document-requests` | new | current | rewritten, passes |
| `legal-evidence-index` | new | current | rewritten, passes (unverified chains and manifest flags fixed) |
| `legal-matter-dashboard` | new | current | rewritten, passes |
| `legal-matter-intake` | new | current | rewritten, passes |
| `legal-obligation-tracker` | new | current | rewritten, passes |
| `legal-renewal-planner` | new | current | rewritten, passes |
| `legal-signature-request` | new | current | rewritten, passes |

## HR suite (8)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `hr-compensation-review` | new | current | rewritten, passes |
| `hr-employee-onboarding` | new | current | rewritten, passes |
| `hr-interview-scorecard` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `hr-leave-approval` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `hr-org-explorer` | new | current | rewritten, passes |
| `hr-people-dashboard` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `hr-policy-acknowledgement` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `hr-shift-coverage` | new | current | rewritten, passes |

## Finance suite (9)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `finance-budget-variance` | new | current | rewritten, passes against Next; dark/light accessibility and responsive/state captures pass |
| `finance-cashflow-dashboard` | new | current | rewritten, passes on Next; accessibility, responsive/state/entrance and selected-week list geometry pass |
| `finance-close-checklist` | new | stale | rewritten, passes |
| `finance-expense-review` | new | stale | rewritten, passes |
| `finance-invoice-composer` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `finance-payment-run` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `finance-receivables-aging` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `finance-reconciliation` | new | current | pro-industry and demo probes pass on Next; exact currency and matched selection fixed |
| `finance-scenario-forecast` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |

## Fashion suite (6)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `fashion-assortment-planner` | new | current | rewritten, passes |
| `fashion-exchange-selector` | new | current | rewritten, passes |
| `fashion-launch-calendar` | new | current | rewritten, passes |
| `fashion-preorder-planner` | new | current | source-fixture regression, demo, accessibility and responsive/state/entrance captures pass |
| `fashion-collection-line-plan` | new | current | source-fixture regression/demo, both-theme accessibility, responsive/state/entrance captures and workspace draft/save checks pass |
| `fashion-wholesale-order` | new | current | rewritten, passes |

## Commerce suite (4)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `commerce-backorder-allocation` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `commerce-bundle-builder` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `commerce-customer-timeline` | new | current | rewritten, passes on suite runner with source fixtures; Next route check pending |
| `commerce-shipping-estimator` | new | current | rewritten, passed before a formatting-only pass; rerun |

## Scroll and layout (5)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `layout-split-resizer` | new | current |  |
| `layout-workspace-shell` | new | current | block probes pass (block-legal-workspace fails identically on the old shell) |
| `scroll-background-wipe` | new | current | pro-scroll-probe passed (video section needs a webm-capable Chromium) |
| `scroll-chapter-stack` | new | current | pro-scroll-probe passed (video section needs a webm-capable Chromium) |
| `scroll-cinema-frame` | new | current | pro-scroll-probe passed (video section needs a webm-capable Chromium) |

## Marketing, media, navigation and other (39)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `bg-fluted-glass` | new | current |  |
| `bg-topographic-contours` | new | current |  |
| `button-shimmer-track` | new | current |  |
| `cards-prismatic-folder` | new | current |  |
| `collab-call-stage` | new | current | call-stage-states passes |
| `collab-message-list` | new | current |  |
| `content-interactive-spec` | new | current |  |
| `cta-project-brief` | new | current |  |
| `effect-border-tracer` | new | current |  |
| `effect-ink-trail` | new | current |  |
| `features-compare-lenses` | new | current |  |
| `features-integration-trace` | new | current |  |
| `features-shortcut-theatre` | new | current |  |
| `footer-sitemap-atlas` | new | current |  |
| `hero-layout-playground` | new | current |  |
| `hero-signal-workbench` | new | current |  |
| `media-audio-transport` | new | current | audio-player-states passes |
| `media-caption-styler` | new | current |  |
| `media-compare-grid` | new | current |  |
| `media-crop-workbench` | new | current |  |
| `media-device-switcher` | new | current |  |
| `media-focus-lightbox` | new | current |  |
| `media-image-contact-sheet` | new | current |  |
| `media-spatial-collection` | new | current |  |
| `media-track-list` | new | current | audio-player-states passes |
| `media-transcript-player` | new | current |  |
| `media-trim-timeline` | new | current |  |
| `navigation-context-rail` | new | current |  |
| `navigation-lens-dock` | new | current |  |
| `navigation-stacked-tabs` | new | current |  |
| `pixel-halftone-image` | new | current |  |
| `portfolio-project-reel` | new | current |  |
| `pricing-seat-simulator` | new | current |  |
| `pricing-usage-calculator` | new | current |  |
| `social-proof-case-ledger` | new | current |  |
| `text-number-odometer` | new | current |  |
| `text-optical-weight` | new | current |  |
| `text-outline-fill` | new | current |  |
| `text-path-typesetter` | new | current |  |

## Component bugs the new probes found (all eight resolved)

1. `legal-evidence-index`: an exhibit with no hashed hand-offs says "Matches at all 0 recorded hand-offs" and counts as intact. The footer says broken exhibits are flagged in the manifest, but the payload has no flag.
2. `saas-customer-health`: `renewsOn: "not-a-date"` crashes with RangeError; `trend: []` draws NaN paths and "last 0 weeks".
3. `saas-usage-policy`: a host policy with `warnAt` above `limit` is accepted silently; `daily: []` draws a path with no moveto.
4. `saas-support-triage`: a rejected `onUndo` is unhandled (no alert, ticket already restored); `receivedAt: "yesterday"` renders NaN. Clicking a route within the ~150 ms reader crossfade routes the previous ticket.
5. `finance-scenario-forecast`: a negative opening balance reads as never running out; "1 months"; scenario tabs lack arrow keys; `scenarios=[]` renders nothing.
6. `finance-invoice-composer`: the pay-online line and receipt link are hard-coded to the demo company and invented when the host returns none.
7. `finance-invoice-composer`: Remove line is hidden below a 672px container, so lines cannot be removed on narrow cards.
8. `finance-receivables-aging`: ticking a not-yet-due invoice says "0 days past due"; invalid due dates age as "Over 90 days"; invoices for unknown customers count in totals without a row.

## Other probes that still assert old UIs

- `tests/browser/pro-50-demo-probe.mjs` `finalStates` (old receipt texts for several slugs).
- `tests/browser/pro-native-themes-probe.mjs` (fashion-exchange-selector no longer has native inputs).
- `tests/browser/preview-cascade-probe.mjs` (uses the old fashion-launch-calendar h2 and `data-demo="day-20"`).
- `tests/browser/audit-trail-polish-probe.mjs` (old date-range panel and diff headings).
- Reconciliation cross-cutting probes updated and passing on Next.
