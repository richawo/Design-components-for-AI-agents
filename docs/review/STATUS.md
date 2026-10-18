# Review status

170 components are rebuilt (or, for a few, polished), verified and committed. For each: whether its demo video
needs re-recording, whether its poster is current, and the state of its browser regression probe.

- **Video**: `new` means `public/previews/<slug>.mp4` still shows the old version. Re-record serially on a quiet machine:
  `node scripts/record-demos.mjs <slug> --isolated-source`.
- **Poster**: `stale` means retake it with `node scripts/screenshot.mjs <slug>` (the preview server was overloaded).
- **Probe**: the `tests/browser/pro-50/<slug>.mjs` state, or another probe that covers it. Blank means no browser test
  was written in this review; those are the ones for a separate pass.

## Batch verification (18 October 2026)

The Font Pairing, Spacing Inspector, Keyframe Track and Layer Stack batch passes its workflows, controls,
component audits and reviewed films. The complete Next-backed run passes **59/59**, including all 20 mobile,
12 data/chart and eight editor regressions, all 62 metadata replays, page/access boundaries and every industry
group. A subsequent Layer Stack save-settlement fix passes its expanded 33-mount source review, 24 state/default
accessibility audits and focused Next, control, audit and demo reruns. Other tracked sources are unchanged.
Strict registry, root and isolated Pro types, and all 1,063 unit tests pass. The final Worker dry run measures a
2,655,633-byte router, 57,158,216-byte runtime and 4,763,194 bytes of compressed source maps. Existing guards
remain, and the three diagnostic packages' runtime files are verified. No deployment was performed.
The separate component-page loading evidence and earlier checkpoints remain recorded.
See [the handoff checkpoint](HANDOFF_TASKS.md#8-final-release-checks) for revisions, measurements and evidence.

## Mobile (20)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `mobile-attachment-tray` | current | current | Native-web/Next regression, available-theme accessibility and three controls pass; neutral four-file delivery film and Next poster refreshed |
| `mobile-budget-envelope` | current | current | Native-web/Next pointer/keyboard regression, six state accessibility audits and four controls pass; closed backdrop hit-testing and focus return fixed; neutral ruler/assignment film and Next poster refreshed |
| `mobile-channel-thread` | current | current | review-mobile-probe passes with source fixtures; web accessibility state fixed |
| `mobile-day-planner` | current | current | source-fixture regression passes; keyboard rescheduling, conflicts, failure/retry payload and empty day covered |
| `mobile-file-preview` | current | current | source-fixture regression and accessibility pass; keyboard scrubbing, invalid counts and download retry covered |
| `mobile-focus-session` | current | current | review-mobile-probe passes with source fixtures; web accessibility state fixed |
| `mobile-habit-grid` | current | current | source-fixture regression and accessibility pass; Space activation, failed mark retry, pending/disabled cells and empty habits covered |
| `mobile-journal-prompt` | current | current | source-fixture regression, accessibility and state captures pass; keyboard tabs, per-prompt drafts, save retry, limits and empty prompts covered |
| `mobile-meeting-preflight` | current | current | source-fixture regression and accessibility pass; keyboard device dialog, settings, failed join retry and cancellation covered |
| `mobile-mood-map` | current | current | source-fixture regression, accessibility and demo replay pass; unselected handle, drag/keyboard choices, retained-note retry, limits and invalid feelings covered |
| `mobile-notification-digest` | current | current | source-fixture regression and accessibility pass; keyboard actions/snooze, failed callbacks, Undo, collapsed piles and empty digest covered |
| `mobile-offline-outbox` | current | current | source-fixture regression passes; retained draft retry, discard confirmation and network pause/resume covered |
| `mobile-packing-list` | current | current | Next-backed regression, preview controls and RN-web accessibility pass; keyboard quantity bounds, serialized/rebased saves, retained edits, retry, Undo and written empty state covered |
| `mobile-project-switcher` | current | current | dedicated regression, preview controls and five RN-web accessibility states pass; dialog focus/dismissal, pending and failed switch/access retries, retained search through delayed motion settings and preference changes, exact payloads and empty workspaces covered; poster/film refreshed |
| `mobile-reading-progress` | current | current | Next-backed regression and seven RN-web accessibility states pass; real drag, keyboard page bounds/tabs, bookmarks, failed opening/retry, abort/late completion, repagination, unavailable pages and empty chapters covered |
| `mobile-review-annotations` | current | current | Next-backed regression, nine RN-web accessibility states and preview controls pass; pointer/keyboard placement, retained draft retries, pending locks, hidden controls, accent contrast, full composer geometry and empty/invalid pins covered; poster/film refreshed |
| `mobile-sync-conflict` | current | current | Next-backed regression, nine RN-web accessibility states and preview controls pass; real drag, keyboard choices, revised retry payloads, pending/resumed/unavailable/empty states, inert exits and late keyed-revision replies covered |
| `mobile-task-move` | current | current | Next-backed regression, eleven RN-web accessibility states and preview controls pass; real drag, keyboard bounds/blocked states, retained-note retries, pending locks, exact move/Undo payloads, failed Undo recovery, host count snapshots during pending requests, header callbacks and one/empty workflows covered; poster/film refreshed |
| `mobile-trip-itinerary` | current | current | Next-backed regression, eleven RN-web accessibility states and preview controls pass; keyboard tabs, selected-leg scroll/focus, booking failure/retry, cancellation, supersession, exact payloads, keyed trip replacement and empty/invalid legs covered; poster/guarded film refreshed |
| `mobile-voice-memo` | current | current | Next-backed regression, twelve RN-web accessibility states and preview controls pass; real waveform drag, keyboard seek bounds, autoplay/transport callbacks, transcript/marker navigation, exact share payloads, fractional/invalid durations, recording resets, readable accents and decimal clock covered; poster/guarded film refreshed |

## Data and charts (12)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `chart-box-distribution` | current | current | Next-backed regression, both-theme default and six state audits, seven controls pass; real drag/keyboard, sort/retry retention, initial-load retry and resizing, stable axis/bounds, invalid settings, finite extremes and plain decimal ARIA covered; poster/guarded film refreshed; first-frame/late-observer resize regression, light handle/target contrast, alpha/neutral/unsupported accent checks and painted official audit pass |
| `chart-calendar-heatmap` | current | current | Next-backed regression, eighteen theme/state accessibility audits and six controls pass; keyboard/pointer/legend actions, exact zero/null callbacks, retained retry choices, leap/small ISO years, controlled years/pins, future-hover clearing, invalid settings and unmeasured/large totals covered; poster/guarded film refreshed |
| `chart-funnel-dots` | current | current | Next-backed regression, fourteen theme/state accessibility audits and five controls pass; keyboard clearing/navigation, exact callbacks, controlled segments, retry retention/recovery and resizing, invalid settings and finite/fractional geometry covered; monochrome poster/guarded film refreshed |
| `chart-sankey-paths` | current | current | Next-backed regression, fourteen theme/state accessibility audits and four controls pass; keyboard node/ribbon traces, exact callbacks, controlled/empty periods, retry retention and resizing, tooltip bounds/descriptions, label contrast and invalid/fractional/large data covered; monochrome poster/guarded film refreshed |
| `chart-scatter-brush` | current | current | Next-backed regression, twenty theme/state accessibility audits and five controls pass; real draw/move/cancel, keyboard point pinning, exact records, controlled brushes/datasets, empty/retry states, zero/extreme geometry, normalized brush bounds and unit/accent contrast covered; monochrome poster/guarded film refreshed |
| `chart-sunburst-explorer` | current | current | Next-backed regression, twenty theme/state accessibility audits and five controls pass; pointer/keyboard and hidden-list drills, raw slash-safe paths, focus/retired controls, data replacement/recovery and invalid/cyclic/extreme data covered; monochrome full-viewport film and matching settled Next poster refreshed |
| `chart-waterfall-bridge` | current | current | Rebuilt shared-scale contribution bridge with connected signed bars and a precise selected-balance readout; 37-mount source review and Next keyboard/retry/pending/negative/zero/invalid/extreme/replacement regression pass. Pending selections retain chart focus, including retry, and extreme axis labels stay on one line; original failures are preserved. The older expansion integration probe also passes. Reviewed 3.5s churn/closing inspection film and paired poster are current, with every timing guard retained. Six widths, 16 state/default accessibility audits, entrance/state captures, two controls, official audit, metadata replay and measured 800px poster/framing pass. Strict registry, TypeScript and all 1,063 unit tests pass. |
| `data-bulk-action-review` | current | current | Next-backed regression, twenty-eight theme/state accessibility audits, visible-count contrast checks and three controls pass; exact batches, rejection/retry, omitted/conflicting results, held picks, host-removed receipts and read-only handlers covered; monochrome partial-receipt film and settled Next poster refreshed |
| `data-column-workbench` | current | current | Next-backed regression, twenty-four theme/state accessibility audits and four controls pass; whole-column drag, exact release payloads, keyboard/resize cancellation, focus/shelf retirement, controlled acknowledgement, opaque ids and invalid/empty layouts covered; monochrome 5.8s film and settled Next poster refreshed |
| `data-filter-history` | current | current | Next-backed regression, thirty theme/state accessibility audits and four controls pass; scrub/restore payloads, independent rename retries, pending locks, late replies, stable snapshot identity, typed rules, readable comparisons and invalid/empty states covered; monochrome full-viewport film and matching settled Next poster refreshed |
| `data-query-builder` | current | current | Rebuilt connected conditions and live audience ledger; 31-mount source review and Next exact-match/keyboard/retry/pending/copied-payload/read-only/invalid-data/replacement regression pass. A retained old-source hover check fails at 1.12:1; the retry action now passes AA and the audience count has valid accessible text. Six widths, 20 state/default accessibility audits, entrance/state captures, three controls, official audit, both demo runners and measured 1,100px replay/poster pass. The narrow footer keeps its explanation readable. Custom/native menu checks pass alongside Capacity Planner. Reviewed 3.7s threshold/matching/applied film and paired poster are current; every recording guard passes. Strict registry, TypeScript and all 1,063 unit tests pass. |
| `data-pivot-configurator` | current | current | Next-backed regression and focused picker checks, forty theme/state accessibility audits, four controls and normal/reduced-motion travel proof pass; swaps, exact/opaque drill-down keys, context retirement, schema recovery, finite aggregates, valid Count/single-dimension choices and narrow totals covered; monochrome full-viewport film and matching Next poster refreshed |

## Editors and 3D (12)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `editor-asset-license-sheet` | current | current | Next-backed crop/placement, retry, exact payload, pending and invalid-data regression; twenty-eight theme/state accessibility audits and four controls pass. Reviewed 6.4s film and settled poster current. |
| `editor-branch-compare` | current | current | Next-backed merge choices, scrubbing, exact output, retry, pending and replaced-revision regression; twenty-eight theme/state accessibility audits and four controls pass. Reviewed 5.5s film and settled poster current. |
| `editor-color-token-studio` | current | current | Next-backed pointer/keyboard, palette failure/retry, clipboard, invalid ids, controlled read-only and stale-reply regression passes; eight theme/accent accessibility states, four controls and 320/390/768/1440 geometry pass. Reviewed neutral 5.2s film shows the AA repair and settled Applied receipt; source/delivery/moving-frame guards pass. |
| `editor-export-preset` | current | current | Next-backed pointer/keyboard, exact export, failure/retry, pending locks, empty/invalid options and retired-layer regression pass. Both-theme accessibility, six widths, entrance/state captures, five controls, official audit and refreshed poster pass; reviewed 5.3s reshape/comparison/export film and matching poster are current. |
| `editor-font-pairing` | current | current | Next-backed keyboard/exact-CSS/retry/pending/newer-draft/mutation/empty-catalogue regression passes. Missing writers stay unavailable, and the labelled specimen supports keyboard scrolling. The 27-mount source review, 16 state/default accessibility audits, six widths, entrance/state captures, four controls, official audit and metadata replay pass. The initial 10.5px clipping failure is retained; matching 900px stage/preview heights, complete framing and refreshed poster pass. Strict registry, TypeScript, isolated Pro types and all 1,063 unit tests pass. Reviewed 6.2s face/scale/highlight/applied film and paired poster are current; all recording guards pass. |
| `editor-keyframe-track` | current | current | Next-backed exact-hold/keyboard/drag-commit/copied-payload/add-delete/playback/empty/invalid-clock regression passes. Overlapping phone targets are fixed with a contained timeline, 44px coarse-pointer targets and independent Home/End/arrow panning. Original failures are retained. The 35-mount source review, 28 state/default accessibility audits, six widths, entrance/state captures, five controls, official audit, actual-edit metadata replay and complete 880px framing/poster pass. Strict registry, TypeScript, isolated Pro types and all 1,063 unit tests pass. Reviewed 5.05s playback/curve-edit/selected-key film and paired poster are current; all recording guards pass. |
| `editor-layer-stack` | current | current | Next-backed pointer/keyboard/reorder/rename/visibility-retry/copied-bounds/read-only/empty/duplicate regression passes. Proposals preserve the actual rollback frame, and selection immediately retires the previous inspector. Its 33-mount source review, 24 state/default accessibility audits, six widths, entrance/state captures, four controls, official audit and complete 900px replay/poster pass. The exploded-stage caption now meets 7.84:1 dark and 5.64:1 light in a direct contrast regression; the original failure is retained. Metadata replay requires Moon to move above Wave and collapse. Strict registry, TypeScript, isolated Pro types and all 1,063 unit tests pass. Reviewed 4.77s stack-reorder/collapse film and paired poster are current; all recording guards pass. Dependent async writes wait for acknowledgement; rejection preserves earlier accepted changes. Focus returns to a failed action without stealing later inspection focus. Controlled stacks without a writer and pending inspector actions stay unavailable; original overlap and inspector failures are preserved. The focused Next, audit, control and demo reruns pass after the 59/59 batch checkpoint. |
| `editor-spacing-inspector` | current | current | Next-backed pointer/keyboard/linked-padding/snap/exact-layout/clipboard-retry/stale-reply/mutation/empty/invalid regression passes. Its 27-mount source review, 14 state/default accessibility audits, six widths, entrance/state captures, five controls, official audit and metadata replay pass; the replay requires a real padding increase. The initial 60.7px clipping failure is retained; matching 960px stage/preview heights, complete framing and refreshed poster pass. Strict registry, TypeScript, isolated Pro types and all 1,063 unit tests pass. Reviewed 4.6s padding/row/alignment film and paired poster are current; all recording guards pass. |
| `editor-storyboard-strip` | new | current | Next-backed pointer/keyboard reorder, released trim, normalized/no-op duration input, copied scene/tone callbacks, playback/empty/invalid-timing regression passes. Inspector context and mid-grey Play contrast are fixed; original failures are retained. The 33-mount source review, eighteen state/default accessibility audits, six widths, entrance/state captures, four controls, official audit, actual-reorder/half-second-edit metadata replay and complete 900px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. |
| `editor-version-restore` | current | current | Next-backed keyboard/exact-payload/copied-request/retry/pending/Undo/missing-block/empty-history/document-replacement regression passes. Local restoration remains supported; late replies cannot replace newer host content. Light deletion text and custom-accent contrast are fixed; original failures are retained. The 29-mount source review, twenty-two state/default accessibility audits, six widths, entrance/state captures, four controls, official audit, actual single-block-restore metadata replay and complete 900px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. Reviewed 6.2s revision/partial-restore film and paired poster are current; all recording guards pass. |
| `three-exploded-assembly` | current | current | Next-backed real-canvas/range/keyboard/cancellation/exact-commit/copied-callback/refusal/controlled/read-only/empty/invalid/WebGL-recovery regression passes. Light part descriptions, stack labels and canvas hints retain contrast; selected numbered markers choose black or white ink for custom accents. Original failures are retained. Its 39-mount source review, thirty-four state/default accessibility audits, direct resolved-colour checks, six widths, entrance/state captures, four controls, official audit, actual-canvas metadata replay and complete 840px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. Reviewed 5.15s gasket/separation/turn film and paired poster are current; all recording guards pass. |
| `three-material-inspector` | new | current | Next-backed real-canvas/finish/range/keyboard/cancellation/exact-commit/copied-callback/refusal/controlled/read-only/empty/invalid/WebGL-recovery regression passes. Parameter terms have valid definition-list relationships and reflect the selected finish; the light canvas hint retains contrast. Original failures are preserved. Its 35-mount source review, thirty state/default accessibility audits, direct resolved-colour check, six widths, entrance/state captures, three controls, official audit, actual-canvas finish/light/turn metadata replay and complete 820px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. |

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

## Application workflows (1)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `app-permission-matrix` | current | current | Rebuilt role matrix, prerequisite inspector and grant/remove ledger; 25-mount source review and Next dependency/bulk/keyboard/exact-payload/retry/pending/mutation/revision regression pass. Accepted host echoes retain an announced receipt, different replacements retire old replies, and Workspace Settings checks its exact saved policy. Both-theme short-viewport pointer/focus correction, 5.60:1 dark and 5.28:1 light checkbox boundaries, six widths, entrance/state captures, touch targets, two controls, official audit and complete 1,200px two-change replay/poster pass. Reviewed 3.5s prerequisite/save film and paired poster are current. Strict registry, TypeScript and all 1,063 unit tests pass. |

## SaaS suite (10)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `saas-access-requests` | current | current | rewritten, passes |
| `saas-audit-trail` | new | current | workflow, metadata replay, first-frame popup state, keyboard/pointer dismissal and both-theme open-menu accessibility pass |
| `saas-customer-health` | new | current | rewritten, passes (invalid dates and empty trends fixed) |
| `saas-integration-manager` | current | current | rewritten, passes |
| `saas-notification-inbox` | new | current | rewritten, passes |
| `saas-report-scheduler` | new | current | rewritten, passes |
| `saas-saved-views` | new | current | rewritten, passes |
| `saas-support-triage` | new | current | rewritten, passes against Next; pending/rejected undo, exiting controls and invalid timestamps fixed |
| `saas-usage-policy` | new | current | rewritten, passes (warning thresholds and empty usage fixed) |
| `saas-workspace-dashboard` | new | current | rewritten, passes |

## Legal suite (9)

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
| `legal-version-history` | current | current | Rebuilt revision rail and numbered paper redline; 29-mount source review and Next keyboard/LCS/retry/copied-snapshot/pending/focus/revision regression pass. Added-line ink is corrected after a retained 4.26:1 contrast failure. Six widths, 16 accessibility audits, entrance/state captures, three controls, official audit, both demo runners and measured 1,200px replay/poster pass. Strict registry, TypeScript and all 1,063 unit tests pass. Reviewed 4.3s redline/confirmation/new-current film and paired poster are current; all recording guards pass. |

## HR suite (9)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `hr-capacity-planner` | current | current | Rebuilt weekly capacity ledger and quarter-hour allocation inspector; 35-mount source review and Next keyboard/exact-snapshot/retry/pending/host-echo/replacement regression pass. Pending calendar inspection remains keyboard-scrollable, and acknowledged decimals become a clean baseline. Six widths, 24 state/default accessibility audits, entrance/state captures, three controls, official audit, both demo runners and measured 1,200px replay/poster pass. The original demo ordering failure is retained; inspection now precedes the final saved receipt. Reviewed 4.5s allocation/inspection/save film and paired poster are current; measured 1,100px framing removes the first capture’s unused stage strip, and every timing guard passes. Strict registry, TypeScript and all 1,063 unit tests pass. |
| `hr-compensation-review` | new | current | rewritten, passes |
| `hr-employee-onboarding` | new | current | rewritten, passes |
| `hr-interview-scorecard` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `hr-leave-approval` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `hr-org-explorer` | new | current | rewritten Next regression passes, including held-frame tree/search focus ownership; both-theme accessibility and successive keyboard navigation pass |
| `hr-people-dashboard` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `hr-policy-acknowledgement` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `hr-shift-coverage` | new | current | rewritten, passes |

## Finance suite (9)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `finance-budget-variance` | new | current | rewritten, passes against Next; dark/light accessibility and responsive/state captures pass |
| `finance-cashflow-dashboard` | new | current | rewritten, passes on Next; accessibility, responsive/state/entrance and selected-week list geometry pass |
| `finance-close-checklist` | new | current | rewritten, passes |
| `finance-expense-review` | new | current | rewritten, passes |
| `finance-invoice-composer` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `finance-payment-run` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `finance-receivables-aging` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `finance-reconciliation` | new | current | pro-industry and demo probes pass on Next; exact currency and matched selection fixed |
| `finance-scenario-forecast` | new | current | rewritten, passes on the Next-backed source-fixture runner |

## Fashion suite (8)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `fashion-assortment-planner` | new | current | rewritten, passes |
| `fashion-exchange-selector` | new | current | rewritten, passes |
| `fashion-launch-calendar` | new | current | rewritten, passes |
| `fashion-preorder-planner` | new | current | source-fixture regression, demo, accessibility and responsive/state/entrance captures pass |
| `fashion-collection-line-plan` | new | current | source-fixture regression/demo, both-theme accessibility, responsive/state/entrance captures and workspace draft/save checks pass |
| `fashion-merchandising-dashboard` | new | current | source-fixture regression/demo, both-theme accessibility, responsive/state/entrance captures and workspace checks pass |
| `fashion-size-guide` | new | current | source-fixture regression/demo, native palettes, both-theme accessibility and responsive/state/entrance captures pass |
| `fashion-wholesale-order` | new | current | rewritten, passes |

## Commerce suite (11)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `commerce-catalog-import` | current | current | Rebuilt CSV/mapping/typed-record workbench; 31-mount source review and Next keyboard/parser/validation/pagination/exact-payload/retry/pending/mutation/revision regression pass. Both-theme accessibility, six widths, entrance/state captures, touch targets, two visible controls, official audit and complete 1,100px replay/poster pass. Native/custom mapping remains an API option; singular count labels are correct. Reviewed 4.2s source/map/review/import film and paired poster are current. Strict registry, TypeScript and all 1,063 unit tests pass. |
| `commerce-variant-stock` | current | current | Rebuilt product matrix and changed-cell ledger; 29-mount source review, keyboard/exact-snapshot/retry/pending/mutation/revision Next regression, both-theme accessibility, six widths, entrance/state captures, 44px touch targets, three controls, official audit and full 1,100px replay/poster pass. Sticky phone totals keep the last size clickable; footer actions fit their padding and stale alerts retire. Reviewed 3.8s film shows the exact 197-unit saved state and passes every recording guard. Strict registry, TypeScript and all 1,063 unit tests pass. The shared demo player now exposes cells inside nested scrollers; the narrow legacy replay reaches 5 and saves, with its old failure and blocked-scroll negative retained. |
| `commerce-return-desk` | current | current | Rebuilt item ledger and return slip; 25-mount source review plus both-theme normal-motion phase guard, exact-amount/retry/pending/revision/retained-edit Next regression, Commerce Workspace integration, both-theme accessibility, six widths, entrance/state captures, 44px touch targets, two controls, official audit and complete 1,100px demo/poster pass. Strict registry, TypeScript and all 1,063 unit tests pass. Unchecked choice boundaries now pass a painted-colour regression at 5.60:1 dark and 5.28:1 light. Its reviewed replacement 6.0s film and paired poster are current. Retiring feedback is inert and leaves the accessibility tree immediately. |
| `commerce-operations-dashboard` | current | current | Rebuilt revenue/flow/channel dashboard; 24-mount source review, Next exact-total/inspection/history/empty regression, full-month replay, both-theme accessibility, six widths, entrance/state captures, two controls and official audit pass. Measured 1,240px preview and refreshed poster retain the whole ledger; reviewed 3.2s Retail/month film and paired poster are current. |
| `commerce-fulfilment-desk` | current | current | Rebuilt parcel/route/recovery workflow; 23-mount source review, Next retained-note/retry/pending/revision/empty regression, recorded-request replay, both-theme accessibility, six widths, entrance/state captures, two controls, official audit and measured full-frame poster pass; reviewed 5.7s recovery/note/review/record film and paired poster are current. Retiring feedback is inert and leaves the accessibility tree immediately. |
| `commerce-purchase-order` | current | current | Rebuilt PO document; 22-mount source review, Next exact-cost/retry/pending/supplier regression, three-line saved-draft replay, both-theme accessibility, six widths, entrance/state captures, three controls, official audit and refreshed poster pass; reviewed 4.1s add/review/save film and paired poster are current. Retiring feedback is inert and leaves the accessibility tree immediately. |
| `commerce-promotion-builder` | current | current | Rebuilt offer ticket and exact line-level receipt; 22-mount source review, Next workflow, both-theme accessibility, six widths, entrance/state captures, three controls, official audit and refreshed poster pass; reviewed 4.2s audience/savings/save film and paired poster are current. Retiring feedback is inert and leaves the accessibility tree immediately. |
| `commerce-backorder-allocation` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `commerce-bundle-builder` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `commerce-customer-timeline` | new | current | rewritten, passes on the Next-backed source-fixture runner |
| `commerce-shipping-estimator` | new | current | rewritten, passes on the Next-backed source-fixture runner |

## Scroll and layout (8)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `layout-split-resizer` | new | current |  |
| `layout-workspace-shell` | new | current | all eight block workflows and retained-panel/focus checks pass; header menus stay above embedded drawers |
| `scroll-background-wipe` | new | current | complete Next-backed scroll suite passes, including exact reversal and reduced motion |
| `scroll-chapter-stack` | new | current | complete pro-scroll-probe passes; first-frame resize release, before/after/negative replay and both-theme accessibility verified |
| `scroll-cinema-frame` | new | current | complete Next-backed scroll suite passes; exact reversal, playable WebM, offscreen pause and broken-film recovery verified |
| `scroll-expanding-mosaic` | new | current | source-fixture scroll/reversal, live demo, failed-image/empty/long-copy/reduced-motion states, controls and accessibility pass |
| `scroll-horizontal-showcase` | new | current | source-fixture scroll/reversal, demo, keyboard, bitmap/failed-image/empty/reduced-motion states, controls and accessibility pass; project-width text layout verified |
| `scroll-image-curtain` | new | current | source-fixture scroll/reversal, live demo, keyboard, failed-image/long-copy/reduced-motion states, controls and accessibility pass |

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

## Cross-cutting browser checks

- The latest complete run passed 52 of 56 suites, including all industry workflows, page/licence boundaries, block workflows and mobile recovery checks.
- Bento now waits for its complete entrance before checking zero mutations and exact historical data. All four theme/motion/ambient cases pass; an injected loop is rejected.
- Audit Trail's first-frame popup state and keyboard/pointer dismissal are fixed. Its workflow, metadata replay and both-theme open-menu accessibility pass; the blocked-End control is rejected.
- The complete scroll suite passes with exact reversal, first-frame chapter release, playable WebM, offscreen pause and broken-film recovery.
- All 23 metadata replays from the interrupted HR/legal/SaaS tail now pass, as does Audit Trail's separate replay. Leave approval also passed three traced attempts. Its earlier lost click remains unreproduced; assertions stay strict and failures now preserve clicks, targets and geometry.
- Repeat the complete suite after the remaining component work. Targeted passes do not replace that final run.
