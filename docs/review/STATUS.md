# Review status

202 components are rebuilt (or, for a few, polished), verified and committed. For each: whether its demo video
needs re-recording, whether its poster is current, and the state of its browser regression probe.

- **Video**: `new` means `public/previews/<slug>.mp4` still shows the old version. Re-record serially on a quiet machine:
  `node scripts/record-demos.mjs <slug> --isolated-source`.
- **Poster**: `stale` means retake it with `node scripts/screenshot.mjs <slug>` (the preview server was overloaded).
- **Probe**: the `tests/browser/pro-50/<slug>.mjs` state, or another probe that covers it. Blank means no browser test
  was written in this review; those are the ones for a separate pass.

Commerce, Fashion, Financial Report, Legal and Meetings Workspace have completed their block reviews.
The preceding four-block checkpoint covers **all 65 browser suites across runs**: the complete run is **63/65**, followed
by **2/2 complete port-corrected suites** without an environment override. All **94 exact metadata replays**
pass. The only changes between browser runs are two legacy preview-port defaults; component sources and
metadata stay unchanged. Original failures and exact hash proofs remain archived.

Fresh audits have passing results for all fourteen changed components across the original run and corrected
Workspace Shell follow-up. All **140 current audit captures** are visually approved, including 32 exact
reviewed block references and eight separately inspected changed block views. Read-only retained panes now
have an explicit keyboard stop and visible focus ring. Strict registry, root/all-eleven-block types and all
**1,066 unit tests** pass.

The Worker dry run at public `05f4d20` / private `7ee48b6` passes unchanged limits at **2,655,633 router bytes,
57,546,310 runtime bytes and 4,781,259 compressed source-map bytes**. Both heads, standing edits and all
1,682 public / 1,151 private snapshotted source-and-media files stay fixed within each verification phase.
The three diagnostic packages retain byte-identical runtime files. No manual deployment was performed.
Evidence is in `test-results/handoff-four-blocks-20261020/`; see the measured checkpoint in `HANDOFF_TASKS.md`.

All eight final smaller components also have reviewed current films and posters. Fashion, Legal and Meetings have
reviewed current block films and paired posters. Commerce and Financial Report retain their old films after
guarded rejections; rejected raw evidence remains local. Legal's new take reaches its completion receipt after
the recorder's scrolling-target correction. The remaining inventory is **6 blocks, 59 older probes and 120 films**.
Allocation Chart needs a new film after its full-value readout changed.

The 20 October table follow-up fixes offscreen reduced-motion figures remaining at zero. Initial and live
preferences now settle the values independently of the intersection observer and clear prior rise/blur effects.
The registered table suite and full Financial Report workflow pass through Next with unchanged exact-value
assertions. Nineteen source mounts, six accessibility audits and twenty approved captures pass; all twelve
settled defaults match their approved references byte-for-byte. Strict registry, root/all-eleven-block types
and all 1,068 unit tests pass. The original combined-run failure and rejected intermediate blur remain archived.
Meetings has since completed its integration and media review, as recorded below.

Music's ownership follow-up protects its live queue from callback mutation and reads liked state from own
properties for opaque track IDs. Both original failures are preserved. Four native mounts, four accessibility
audits, all four reviewed captures and the registered source-fixture workflow pass with strict registry,
root/all-eleven-block types and all 1,068 unit tests. Row Pause has since been wired to the real transport
through its optional pauseRequest counter. Both source-fixture suites, twelve transport state audits and
the two-theme Music row check pass with reviewed captures. Its unchanged 1,500ms regression now measures
from trusted click dispatch, and still rejects the original source. The full Music review remains open;
the remaining counts above are unchanged.

## Previous workspace/input checkpoint (19 October 2026)

The workspace/input checkpoint covers **all 64 browser suites across runs**: the full run is 63/64,
and the complete corrected Expansion follow-up passes. The sole failure was an obsolete empty-booking
assertion; production source stays unchanged and the test-only fix is pushed as `41e75c1`. All **86 exact
metadata replays** pass against frozen source steps. The original full result and diagnostic capture remain
archived. The final smaller-component checkpoint above supersedes this earlier batch.

Fresh Setup, Booking, Dropzone and Shortcut Recorder audits pass with no runtime, accessibility or
reduced-motion failures. All **40 images match the reviewed references byte-for-byte**; four fresh 320px
views are read again. Both heads, all 938 public and 1,138 private tracked text sources and standing edits
remain unchanged through each frozen verification phase. Strict registry, root/exact isolated types and
all 1,066 unit tests pass. The Worker dry run passes with the original guards: router 2,655,633,
runtime 57,305,433 and compressed maps 4,776,932 bytes. Known package-copy
diagnostics retain complete byte-identical runtime files. No manual deployment is performed.
See the latest checkpoint in `HANDOFF_TASKS.md`.

Story Deck also passes its 31-mount source review, twelve accessibility audits, six widths, Next regression,
theme control and exact three-study replay. Its reviewed 3.6s film and paired poster pass every recording guard.
Request Waterfall also passes its 33-mount source review, eighteen accessibility audits, Next workflow,
theme control and exact request replay. Its reviewed Next poster is current; the rejected film remains queued.
JSON Inspector passes its 41-mount review, twenty-eight accessibility audits, Next checks and exact fold replay.
Its reviewed 3.8s film and paired poster pass every recording guard.
Before/After passes its 39-mount review, 22 accessibility audits, Next checks and exact range replay.
Its reviewed four-second film and paired poster pass every recording guard. Shared native range replay is fixed.
Kanban, File Explorer, Communication Preferences and Weekly Agenda also have current reviewed films and paired
posters. The complete 63-suite / 82-replay interface checkpoint is verified.

Remaining queues: **11 blocks, 59 dedicated probes and 117 films**.

## Previous input checkpoint (19 October 2026)

Number Stepper, Password Checklist, Tag Editor and Colour Swatches pass their source reviews, Next workflows,
controls, fresh component audits and reviewed films. Together they cover 174 source mounts and 92 state/default
accessibility audits; all forty fresh audit captures are byte-identical to the reviewed originals.

The complete browser run finished at **58/60**, with all **70 metadata replays** passing. Its two failed probes
pass after the legacy tag-capacity test correction and tooltip accessibility follow-up, giving every suite a
passing result across the full and focused runs. All mobile, data/chart, editor/3D, block, page/access and industry
groups pass. The original cold tooltip sampling miss remains archived and its cause is unconfirmed; all timing
and frame-count guards remain. The tooltip's warm crossfade now exposes only the current accessible description,
verified in both themes and motion modes, with normal appearance unchanged.

Strict registry, root and isolated Pro types, and all 1,064 unit tests pass. At public `a0af2a8`, private
`c87d16c`, all 916 public and 1,138 private tracked text sources, heads and standing changes remain
unchanged through focused checks, audits and the Worker dry run. It measures a 2,655,633-byte
router, 57,210,921-byte runtime and 4,765,993 bytes of compressed maps, with every guard
retained and the three diagnostic packages' runtime files verified. No manual deployment was performed.
See [the handoff checkpoint](HANDOFF_TASKS.md#8-final-release-checks) for revisions, limitations and evidence.

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
| `editor-storyboard-strip` | current | current | Next-backed pointer/keyboard reorder, released trim, normalized/no-op duration input, copied scene/tone callbacks, playback/empty/invalid-timing regression passes. Inspector context and mid-grey Play contrast are fixed; original failures are retained. The 35-mount source review, twenty state/default accessibility audits, six widths, entrance/state captures, four controls, official audit, actual-reorder/half-second-edit metadata replay and complete 900px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. Held edits stop after outside release or loss of window focus; its original failing case is retained. The keyboard duration-step replay passes at 1440px and a measured fixed union at 1024px. Reviewed 6.23s playback/reorder/duration film and paired poster are current. Its measured 1024px fixed union retains the entire replay; all unchanged recording guards pass. Earlier rejected takes remain archived. |
| `editor-version-restore` | current | current | Next-backed keyboard/exact-payload/copied-request/retry/pending/Undo/missing-block/empty-history/document-replacement regression passes. Local restoration remains supported; late replies cannot replace newer host content. Light deletion text and custom-accent contrast are fixed; original failures are retained. The 29-mount source review, twenty-two state/default accessibility audits, six widths, entrance/state captures, four controls, official audit, actual single-block-restore metadata replay and complete 900px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. Reviewed 6.2s revision/partial-restore film and paired poster are current; all recording guards pass. |
| `three-exploded-assembly` | current | current | Next-backed real-canvas/range/keyboard/cancellation/exact-commit/copied-callback/refusal/controlled/read-only/empty/invalid/WebGL-recovery regression passes. Light part descriptions, stack labels and canvas hints retain contrast; selected numbered markers choose black or white ink for custom accents. Original failures are retained. Its 39-mount source review, thirty-four state/default accessibility audits, direct resolved-colour checks, six widths, entrance/state captures, four controls, official audit, actual-canvas metadata replay and complete 840px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. Reviewed 5.15s gasket/separation/turn film and paired poster are current; all recording guards pass. |
| `three-material-inspector` | current | current | Next-backed real-canvas/finish/range/keyboard/cancellation/exact-commit/copied-callback/refusal/controlled/read-only/empty/invalid/WebGL-recovery regression passes. Parameter terms have valid definition-list relationships and reflect the selected finish; the light canvas hint retains contrast. Original failures are preserved. Its 35-mount source review, thirty state/default accessibility audits, direct resolved-colour check, six widths, entrance/state captures, three controls, official audit, actual-canvas finish/light/turn metadata replay and complete 820px framing/poster pass. Strict registry, root/Pro types and all 1,063 unit tests pass. Reviewed 4.78s finish/light/turn film and paired poster are current; the accepted unchanged-source retry passes every recording guard. The first rejected capture is preserved. |

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

## Inputs, forms, dates and selects (14)

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
| `input-color-swatches` | current | current | Next-backed keyboard presets, exact/no-op callbacks, native custom colours, filtered/empty presets, invalid-value repair, controlled/read-only/disabled and live reduced-motion regression passes. The small hex caption retains AA around mid-grey and all control boundaries exceed 3:1. The 45-mount source review, 28 state/default accessibility audits, six widths, entrance/state captures, four controls, official audit and exact Terracotta replay pass. Strict registry, TypeScript and all 1,064 unit tests pass. Reviewed 3.6s film and paired poster are current, with all recording guards retained. |
| `input-tag-editor` | current | current | Next-backed Enter/comma/paste/IME, duplicate/limit, keyboard removal, copied arrays, controlled/read-only/disabled and live reduced-motion regression passes. Adding returns focus to the entry, and its boundary exceeds 3:1 in both themes. The 37-mount source review, twenty state/default accessibility audits, six widths, entrance/state captures, four controls, official audit and exact add/remove replay pass. Strict registry, TypeScript and all 1,064 unit tests pass. Reviewed 3.1s film and paired poster are current, with all recording guards retained. |
| `input-password-checklist` | current | current | Next-backed raw callback, controlled/read-only/disabled, keyboard reveal, empty/custom/single policy, Unicode and live reduced-motion regression passes. Default policy classes and character counting are corrected; empty fields have a measured 3:1 boundary. The 37-mount source review, 22 state/default accessibility audits, six widths, entrance/state captures, four controls, official audit and exact revealed-text replay pass. Strict registry, TypeScript and all 1,064 unit tests pass. Reviewed 3.25s film and paired poster are current, with all recording guards retained. |
| `input-number-stepper` | current | current | Next-backed exact integer/decimal/bound, keyboard/IME, held-pointer retirement, native focus, controlled/read-only/disabled and invalid-data regression passes. Long quantities remain complete at 320px; the ruler remains finite across extreme bounds and settles on live reduced motion. The 55-mount source review, 22 state/default accessibility audits, six widths, entrance/state captures, four controls, official audit and exact metadata replay pass. Strict registry, TypeScript and all 1,064 unit tests pass. Reviewed 3.27s stepping film and paired poster are current, with all recording guards retained. |

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
| `collab-call-stage` | new | current | Full 58-layout/media suite, four painted idle/hover contrast and accessibility checks, fresh official audit and all ten reviewed captures pass. Coarse-pointer header actions retain 44px targets; native 320/390px taps, readable narrow headings and all four reviewed touch captures pass in both themes. Shared Leave text retains 5.69:1 at rest and 4.87:1 on hover. The resting-caption poster is refreshed; its film remains queued. |
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
| `media-audio-transport` | new | current | Full audio-player suite passes, including the optional pauseRequest counter: real native clock, retained position, paused source changes and pause winning simultaneous requests. Two source mounts cover both layouts/themes with twelve accessibility audits and twelve reviewed captures. Music row Pause reaches this transport and passes its unchanged 1,500ms deadline; the old source remains a failing negative. Strict registry, root/all-eleven-block types and all 1,068 tests pass. Its film remains queued. |
| `media-caption-styler` | new | current |  |
| `media-compare-grid` | new | current |  |
| `media-crop-workbench` | new | current |  |
| `media-device-switcher` | new | current |  |
| `media-focus-lightbox` | new | current |  |
| `media-image-contact-sheet` | new | current |  |
| `media-spatial-collection` | new | current |  |
| `media-track-list` | new | current | audio-player-states passes; live reduced-motion/filter retirement, keyboard and real pointer reorder verified |
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

- The interface checkpoint passes all 63 suites and all 82 exact metadata replays in one complete run, with source hashes, heads and standing changes fixed throughout. Setup Checklist, Booking Slots, File Dropzone and Shortcut Recorder now have passing focused checks, fresh audits and complete exact replay coverage. The original full run and corrected-suite result are documented above.
- Bento now waits for its complete entrance before checking zero mutations and exact historical data. All four theme/motion/ambient cases pass; an injected loop is rejected.
- Audit Trail's first-frame popup state and keyboard/pointer dismissal are fixed. Its workflow, metadata replay and both-theme open-menu accessibility pass; the blocked-End control is rejected.
- The complete scroll suite passes with exact reversal, first-frame chapter release, playable WebM, offscreen pause and broken-film recovery.
- All 23 metadata replays from the interrupted HR/legal/SaaS tail now pass, as does Audit Trail's separate replay. Leave approval also passed three traced attempts. Its earlier lost click remains unreproduced; assertions stay strict and failures now preserve clicks, targets and geometry.
- Repeat the complete suite after the remaining component work. Targeted passes do not replace that final run.

## Editorial follow-up (19 October 2026)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `content-release-notes` | current | current | Keyboard filters/disclosure, exact filtered lists, empty/arriving data, invalid limits, live reduced motion and selected-text contrast pass. The 29-mount source review, fourteen state/default accessibility audits, current fourteen-mount selection follow-up with twelve state audits, six widths, entrance/state captures, Next regression, three controls, official audit and exact Features replay pass. Strict registry, TypeScript and all 1,064 unit tests pass. Reviewed 3.5s film and paired poster are current, with all recording guards retained. |
| `cards-event-ticket` | current | current | Native keyboard disclosure, empty/updated programmes, long guest/reference text, independent ticket IDs and live reduced motion pass. The 27-mount source review, fourteen state/default accessibility audits, six widths, entrance/state captures, Next regression, three controls, official audit and exact closed/open/closed replay pass. Strict registry, root/isolated Pro types and all 1,064 unit tests pass. Reviewed 3.32s film and paired poster are current, with every recording guard retained. |
| `chart-slope-comparison` | new | current | Selection callbacks receive independent row copies. Contextual slope strokes improve from the preserved 2.13:1 failure to 4.98:1 dark and 3.41:1 light. Endpoint figures interpolate for 280ms; long units wrap as complete blocks. Keyboard selection, copied payloads, host replacement, negative/non-finite observations, unplottable ranges, empty collections and live reduced motion pass. The 31-mount source review, 16 state/default accessibility audits, six widths, entrance/state captures, Next regression, three controls, official audit and exact replay pass. Strict registry, TypeScript and all 1,064 unit tests pass. The refreshed Next poster is reviewed. Film refresh remains in task 1; rejected captures preserve the published movie and every timing guard. |
| `chart-bullet-targets` | new | current | Long units and large figures stay within 320px, correcting the preserved painted-text overflow. Initial result figures render correctly before client effects; later changes interpolate for 280ms; fills and numbers stop immediately when reduced motion changes, retaining period-button focus. Keyboard periods, exact callbacks/bar fractions, empty periods/metrics, normalized values and host replacement pass. The 29-mount source review, 14 state/default accessibility audits, six widths, entrance/state captures, Next regression, three controls, official audit and exact replay pass. Strict registry, TypeScript and all 1,066 unit tests pass. The refreshed Next poster is reviewed. Film refresh remains in task 1; rejected captures preserve the published movie and every timing guard. |

## Media and developer tools follow-up (19 October 2026)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `media-story-deck` | current | current | Keyboard navigation, exact index notifications, empty stories, initial-index normalization, host replacement and live reduced motion pass. A preserved old-source negative confirms the 8px live-preference regression. The 31-mount source review, twelve state/default accessibility audits, six widths, reviewed entrance/state captures, Next regression, theme control, official audit and exact three-study replay pass. Large figures remain readable at 320px. Strict registry, fresh root types and all 1,066 unit tests pass. Reviewed 3.6s film and paired poster retain the complete measured replay, with every recording guard intact. |
| `devtools-request-waterfall` | new | current | Independent selection payloads, unavailable statuses, keyboard selection, exact timings, empty/singular captures, host replacement, long paths and live reduced motion pass. Original callback-mutation, HTTP 0/NaN and live-preference failures are preserved. The 33-mount source review, eighteen state/default accessibility audits, six widths, reviewed entrance/state captures, Next regression, theme control, official audit and exact three-request replay pass. Strict registry, fresh root/isolated types and all 1,066 unit tests pass. The refreshed Next poster is reviewed. Film refresh stays queued after the unchanged delivery guard rejected 352.23ms; the previous movie is preserved. |
| `devtools-json-inspector` | current | current | Logical-key fold state and focus survive reordered objects. Keyboard disclosure, null/false/empty data, circular versus shared values, depth limits, independent IDs, long data, visibly scrolled 500-entry recovery and live reduced motion pass. Original reorder and mid-entry negatives are preserved. The 41-mount source review, twenty-eight state/default accessibility audits, six widths, reviewed entrance/state captures, Next regression, theme control, official audit and exact usage/tools fold replay pass. Strict registry, fresh root/isolated types and all 1,066 unit tests pass. Reviewed 3.8s film and paired poster retain the measured replay, with every recording guard intact. |
| `media-before-after` | current | current | Pointer/keyboard, controlled acknowledgement/refusal, read-only values, inert artwork, whole-percentage alignment, live reduced motion, forced colours and 320px image bounds pass. The 39-mount source review, 22 accessibility audits, six widths, entrance/state captures, Next regression, theme control, official audit and exact replay pass. Original failures remain archived. Strict registry, fresh types and all 1,066 tests pass. Reviewed four-second film and paired poster pass all recording guards. |

## Interface follow-up (19 October 2026)

| Slug | Video | Poster | Probe |
| --- | --- | --- | --- |
| `data-kanban-compact` | current | current | Independent callback records, inert exits, live reduced motion, keyboard pickup/order, column-action focus and refused-move focus retirement pass. Six original failures and the corrected draft exit regression remain archived. The 41-mount source review, eighteen accessibility audits, six widths, state/entrance captures, Next regression, legacy pointer/touch/keyboard probe, two controls, official audit and exact two-task replay pass. Strict registry, root/isolated types and all 1,066 tests pass. The reviewed 4.5s film and paired poster keep every state in the measured full viewport; all recording guards pass. The original clipped crop is retained. Included in the complete 63-suite / 82-replay checkpoint. |
| `data-file-explorer` | current | current | Independent deep selection copies, stable sibling-key focus, controlled/read-only selection, local deep-tree scrolling and live reduced motion pass. Five original failures are retained. The 37-mount source review, eighteen accessibility audits, six widths, state/entrance captures, Next regression, theme control, official audit and exact select/fold replay pass. Empty/arriving files, opaque IDs, independent projects, bounded cycles and large-tree keyboard scrolling are covered. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.9s film and paired poster keep every state inside the measured initial union, with all recording guards retained. Included in the complete 63-suite / 82-replay checkpoint. |
| `forms-preference-center` | current | current | Independent normalized callback snapshots, read-only controlled choices, disabled empty/unconfigured saves, immediate pending locks, serial writes, retired stale feedback, option-key focus and live reduced motion pass. Seven original failures are retained. Its 41-mount source review, eighteen accessibility audits, six widths, state/entrance captures, Next regression, theme control, official audit and exact select/save replay pass. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 4.0s film and paired poster contain every state in the measured initial union, with every recording guard retained. The forms/dates suite is registered and passes in the complete 63-suite / 82-replay checkpoint. |
| `date-week-agenda` | current | current | Independent event snapshots, stable day/event-key focus, live reduced motion and 12px time metadata pass. Four original failures are retained. Its 31-mount source review, eighteen accessibility audits, six widths, state/entrance captures, Next regression, theme control, official audit and exact Monday-notes/Tuesday replay pass. Empty/arriving schedules, missing-day fallback, host display labels, replaced days, long copy and independent agendas are covered. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 4.0s film and paired poster keep all states visible with every recording guard retained. Included in the complete 63-suite / 82-replay checkpoint. |
| `onboarding-setup-checklist` | new | current | Independent normalized completion arrays, read-only controlled completion, stable task-key focus, live ring/card motion, checkbox contrast and singular remaining-step copy pass. Six original failures are retained. Its 37-mount source review, eighteen accessibility audits, six widths, state/entrance captures, Next regression, theme control, official audit and exact completion/disclosure replay pass. Refused controlled proposals, empty/arriving tasks, long copy and independent checklists are covered. Strict registry, root/isolated types and all 1,066 tests pass. Its settled Next poster is reviewed and current. The film is rejected for a 998.88ms changed-source delivery gap; the old film is retained and the rejected raw capture/metrics remain local with every guard unchanged. The onboarding runner is registered; the next 64-suite / 83-replay batch remains pending. |
| `date-booking-slots` | new | current | Booking Slots copies selection notifications, makes controlled radios read-only without a writer, retains day/slot focus through reordering and settles card/list motion on live reduced-motion changes. Fully unavailable days have a written no-times state and neutral feedback. Month labels use 12px type and long time labels have inner padding. Six original-source failures are retained. Its 37-mount source review, eighteen accessibility audits, six widths, reviewed state/entrance captures, Next regression, theme control, official audit and exact four-state replay pass. Native radio navigation, controlled acceptance/refusal, cleared and unavailable selections, day browsing with retained choices, arriving schedules, host display labels and independent instances are covered. Strict registry, root/isolated types and all 1,066 tests pass. Its settled Next poster is reviewed and current. The film fails its original timing guards (source gap 12ms, delivery 46.99ms and moving-frame p95 53.55ms); the rejected raw capture/metrics remain local, the previous film is retained and every guard stays unchanged. The next 64-suite / 84-replay batch remains pending. |
| `input-file-dropzone` | current | current | Source File Dropzone copies initial and notification arrays, makes controlled selection read-only without a writer, retains row focus through reordering and restores it after accepted removal without stealing it on delayed acknowledgement. Non-file drags are ignored, disabled drag highlights clear, small file/limit labels retain actual byte values, and live reduced motion settles card/row entries. Seven original-source failures are retained. Its 41-mount source review, eighteen accessibility audits, six widths, reviewed state/entrance captures, Next regression, theme control, official audit and exact two-state replay pass. Native file choosing, mixed accepted/rejected drops, MIME/extension rules, duplicates, exact byte/count limits, empty drops, host acceptance/refusal, zero capacity, long content and independent instances are covered. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.1s film and paired poster keep the chooser, selected file and sample action in the measured 832×720 frame: source gap 19ms, delivery 49.24ms; no sustained-motion interval, with no stalls and unchanged guards. The next 64-suite / 85-replay batch remains pending. |
| `input-shortcut-recorder` | current | current | Keyboard Shortcut Recorder copies initial and notification arrays, makes controlled values read-only without a writer and settles its 320ms card entrance on live reduced-motion changes. Feedback follows the actual acknowledged chord and wrapped keycaps retain vertical padding. Four original-source failures are retained. Its 33-mount source review, eighteen accessibility audits, six widths, reviewed state/entrance captures, Next regression, theme control, official audit and exact four-state replay pass. Keyboard activation, ordered modifiers, invalid unmodified keys, function keys, Escape/Tab/blur exit, composition events, reset focus, controlled acceptance/refusal, empty sequences, long labels and independent instances are covered. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 4.0s film and paired poster keep all four keyboard states in the measured 832×600 frame: source gap 12ms, delivery 12.48ms and moving-frame p95 17.55ms, with no stalls and unchanged guards. The next 64-suite / 86-replay batch remains pending. |
| `feedback-empty-search` | current | current | Empty Search retains its document-stack composition and now keeps suggestion focus through reordering, gives wrapped topics 8px inner space, distinguishes a blank query from failed results and settles its 320ms entrance on live reduced-motion changes. Three original-source failures are retained. Its 31-mount source review, sixteen accessibility audits, six widths, reviewed state/entrance captures, Next regression, theme control, official audit and exact three-state replay pass. Keyboard topic/clear actions, exact synchronous requests, host acceptance/refusal, absent handlers, empty suggestions, repeated query values, long text and independent instances are covered. The API stays unchanged. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.8s film and paired poster keep all three query states in the measured 832×760 frame: source gap 13ms, delivery 9.79ms and moving-frame p95 25.12ms, with no stalls and unchanged guards. The next 65-suite / 87-replay batch remains pending. |
| `navigation-pagination-window` | current | current | Windowed Pagination retains its travelling page rail and 44px slot height. Controlled navigation without a writer is read-only, empty result sets keep keyboard focus in the landmark, large labels fit their targets, and the selected outline meets 3:1. Owned card/caption/slot motion settles immediately on live reduced-motion changes, including retiring slots. Six original-source failures are retained. Its 45-mount source review, twenty-four accessibility audits, six widths, reviewed state/entrance captures, Next regression, legacy interpolation probe, theme control, official audit and exact four-state replay pass. Keyboard navigation, first/last bounds, controlled acceptance/refusal, responsive window changes, invalid and single-page totals, large counts and independent instances are covered. The API stays unchanged. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 4.0s film and paired poster keep all four destination states in the measured 832×600 frame: source gap 14ms, delivery 21.04ms and moving-frame p95 24.75ms, with no stalls and unchanged guards. The next 65-suite / 88-replay batch remains pending. |
| `primitives-shortcut-reference` | current | current | Shortcut Reference retains its grouped command list and engraved keycaps. The search boundary meets 3:1, clearing returns focus to the search field, Escape clears a non-empty filter and live reduced motion settles its 320ms entrance. Three original-source failures are retained. Its 31-mount source review, eighteen accessibility audits, six widths, reviewed state/entrance captures, Next regression, theme control, official audit and exact full/filtered/restored replay pass. Label/group/rendered-key filtering, trimmed case-insensitive queries, no matches, empty and arriving items, retained input focus, long content, Unicode search and independent instances are covered. The API stays unchanged. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 4.3s film and paired poster retain the complete full, filtered and restored command lists in the measured 832×760 frame: source gap 11ms, delivery 16.90ms and moving-frame p95 25.10ms, with no stalls and unchanged guards. The next 65-suite / 89-replay batch remains pending. |
| `selects-radio-cards` | current | current | Radio Cards retains its generous native choice cards. Controlled selection without a writer remains legible and read-only, stable option IDs retain focus through reordering, unchecked radio boundaries meet 3:1 and live reduced motion settles the 320ms entrance and 160ms selection mark. Four original-source failures and the separate 600px phone-preview failure are retained. The 920px preview and a stage that fills its viewport retain the complete phone stack, verified in Next and source fixtures at 320/390px. Its 35-mount source review, twenty-two accessibility audits, six widths, reviewed state/entrance captures, Next regression, existing expansion-input regression, theme control, official audit and exact three-selection replay pass. Native arrow selection, disabled choices, controlled acceptance/refusal and clearing, empty and arriving options, long content and independent groups are covered. The API stays unchanged. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.8s film and paired poster retain all three selected states in the measured 832×600 frame: source gap 11ms, delivery 13.36ms and moving-frame p95 17.52ms, with no stalls and unchanged guards. The next 65-suite / 90-replay batch remains pending. |
| `progress-milestones` | current | current | Milestone Progress retains its vertical checkpoints and stage notes. Stable stage IDs retain focus through reordering, control boundaries meet 3:1 and owned 320ms card, 350ms fill and 240ms detail motion settles on live reduced-motion changes. Long titles keep the count together and wrapped stage labels retain inner padding. Three original-source failures are retained. Its 39-mount source review, eighteen accessibility audits, six widths, reviewed state/entrance captures, Next regression, theme control, official audit and exact 25/50/75 percent replay pass. Keyboard stage requests, controlled acceptance/refusal, finite bounds, completed and empty stages, arriving steps, long copy and independent instances are covered. The zero-based positional API stays unchanged and callbacks remain synchronous host navigation requests. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.8s film and paired poster retain the Prototype, Review and Handover states in the measured 832×680 frame: source gap 11ms, delivery 20.31ms and moving-frame p95 24.58ms, with no stalls and unchanged guards. The next 65-suite / 91-replay batch remains pending. |
| `content-accordion-index` | current | current | Editorial Question Index retains its serif heading, numbered questions and measured answer text. Stable item IDs preserve disclosure focus through reordering; owned 320ms card and 240ms answer entrances settle immediately on live reduced-motion changes. Closed answer text leaves the document while labelled disclosure targets remain valid. Two original-source failures are retained. Its 31-mount source review, twenty-two accessibility audits, six widths, reviewed state/entrance captures, Next regression, theme control, official audit and exact three-answer replay pass. Keyboard opening/closure, synchronous observer payloads, absent observers, empty and arriving questions, replacement data, long copy and independent instances are covered. Every answer fits the original 640px phone preview at 320/390px. The API stays unchanged. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.8s film and paired poster retain the handover, timeline and scope-change answers in the measured 832×680 frame: source gap 34ms, delivery 24.03ms and moving-frame p95 24.75ms, with no stalls and unchanged guards. The next 65-suite / 92-replay batch remains pending. |
| `feedback-inline-alert` | current | current | Actionable Inline Notice retains its restrained semantic icon and optional action row. Replaced content retires pending UI and stale replies, while equivalent host renders retain the active operation and use current failure copy. The pending action retains keyboard focus with aria-disabled, without reclaiming it after Tab leaves the notice. Immediate busy guards block keyboard/pointer reactivation and dismissal in the same event turn; unmounted requests cannot change a new instance. Its owned 320ms entry settles on live reduced-motion changes, wrapped actions retain inner padding and their arrow keeps its width. Rendered integration commentary is removed. Four original-source failures are retained. Its 33-mount source review, twenty accessibility audits, six widths, reviewed state/entrance captures, Next and existing input regressions, theme control, official audit and exact archive-opening replay pass. Keyboard action/retry, rejected and pending callbacks, replacement notices, absent handlers, long text and independent instances are covered. The awaited action and synchronous host dismissal API stays unchanged. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.1s film and paired poster retain the ready and opened document archive in the measured 832×600 frame: source gap 10ms, delivery 4.91ms; no sustained-motion interval, with no stalls and unchanged guards. The next 65-suite / 93-replay batch remains pending. |
| `navigation-breadcrumb-fold` | current | current | Folding Breadcrumb retains its compact route rail, real ancestor links and plain current-page label. Stable href/occurrence keys preserve focus through ancestor reordering. Expanding and collapsing transfer focus to the surviving control; removing focused controls retains focus in the landmark without reclaiming it after an outside button or primary blank-space click. Wrapped ancestor labels retain inner padding. Its owned 320ms entrance settles immediately on live reduced-motion changes. Three original-source failures are retained. Its 39-mount source review, twenty accessibility audits, six widths, reviewed state/entrance captures, Next and existing input regressions, theme control, official audit and exact folded/expanded/refolded replay pass. Native link navigation, keyboard disclosure, empty and short paths, long copy, independent landmarks and every phone preview state at 320/390px are covered. The API stays unchanged. Strict registry, root/isolated types and all 1,066 tests pass. Its reviewed 3.8s film and paired poster retain the folded, expanded and refolded path in the measured 832×600 frame: source gap 11ms, delivery 13.55ms and moving-frame p95 25.60ms, with no stalls and unchanged guards. The next 65-suite / 94-replay batch remains pending. |
| `block-commerce-workspace` | new | current | Commerce Workspace now uses compact view-specific headings, a target/order overview that expands across wide containers and one store identity throughout Returns. Modified order links preserve browser intent; empty copy and disabled selectors name their period/order context. Separate period/order drafts, retry, pending requests across period changes, unavailable handlers, arriving data and phone action reachability pass. Its 33-mount source review, 32 accessibility audits, six widths and all 46 reviewed state/entrance captures pass. The registered workflow retains the contrast and narrow-card dependency regressions. Normal-motion headings must finish visibly in the actual Next preview. All eight block metadata replays pass; Commerce verifies item/reason changes, editing, review and the final read-only request receipt. Controls, official audit, strict registry, root/all-eleven-block types and all 1,066 unit tests pass. The public API and Pro dependency boundary stay unchanged. Its reviewed settled Next poster is current. The film fails unchanged timing guards (source gap 37ms, delivery 106.73ms and moving-frame p95 25.93ms; one 109.45ms moving-frame gap); the old film is retained and rejected raw evidence stays local. The four-block release checkpoint above covers this review. |
| `block-fashion-workspace` | current | current | Fashion Workspace now shares its brand across all three tools, uses compact view-specific headings and names empty collections explicitly. Offline weekly histories reconcile to the existing sold-unit ledgers. Retained planning drafts, failed-save retry after a collection change, original typed callback contexts, missing writers, arriving data and keyboard actions at 320/390px pass. Narrow plan actions wrap without splitting words, and readiness text keeps room beside its ring. Compact metrics stack so complete currency amounts remain readable. Its 29-mount source review, forty accessibility audits, six widths and 54 reviewed state/entrance captures pass with frozen sources. Calendar write ownership and merchandising stock-cover contrast regressions remain registered. The exact metadata replay adds a fifteenth style and reaches the saved 530-unit, £17,760.00 plan receipt. Next controls and official audit, strict registry, root/all-eleven-block types and all 1,066 tests pass. Public callback contracts and Pro boundaries remain unchanged. Its reviewed 5.0s film and paired Next poster retain the complete 820px workspace in measured 1400×940 framing: source gap 57ms, delivery 49.62ms and moving-frame p95 28.37ms, with no stalls and unchanged guards. The four-block release checkpoint above covers this review. |
| `block-financial-report` | new | current | Financial Report now uses a compact period-specific workspace, exact headline and cost amounts, a real cost-detail anchor and persistent export feedback. Full currency values preserve the final minor unit at the safe-integer boundary, including negative pennies, across screen totals, table cells, allocation labels, CSV and print. Raw minor units retain numeric sorting and allocation weights; abbreviated chart summaries remain explicit. Keyboard period selection, empty and arriving reports, no costs, independent instances, native CSV/print, failed export retry and retired report/currency/brand/unmount replies pass its 43-mount source review, forty accessibility audits, six widths and 54 reviewed state/entrance captures. Long-amount phone checks and stable chart legend/focus regressions pass. A single allocation view has no redundant grouping chooser; the exact total/focused value uses one stable readout below the ring. The exact September replay reaches the visible export receipt with the £8,700.00 software line intact. Next workflow, controls, official audit and measured full-frame captures pass with strict registry, root/all-eleven-block types and all 1,066 tests. Public callbacks and Pro boundaries remain unchanged. Its reviewed paired Next poster is current. The film fails unchanged timing guards (source gap 22ms, delivery 649.70ms and moving-frame p95 24.42ms); the previous movie is retained and raw rejection evidence stays local. The four-block release checkpoint above covers this review. |
| `block-legal-workspace` | current | current | Legal Workspace now uses compact current-matter chrome, a shared brand/reporting day and useful context counts. Its matter portfolio, obligation evidence and stamped document requests stay in retained panels. Empty and arriving contexts, unique IDs, keyboard navigation, concurrent writes in different matters, hidden failures, exact retry payloads, retained File identity, removed-matter late replies, independent instances, long phone copy and live reduced motion pass 63 source mounts, 82 accessibility audits, six widths and 96 reviewed state/entrance captures. Missing writers keep drafts available without inventing receipt; inbox snapshots protect retries from host mutation. The table keeps its cells outside disclosure buttons, and receipt/revision text remains readable. Invalid or impossible reference dates fall back once to a coherent UTC reporting day. Northline report evidence cites actual DOC-404; Harbour's handover cites accepted DOC-403. The exact metadata replay records the report and settles on its completion stamp. Next workflow, controls, official audit and six measured Next/production states pass with strict registry, root/all-eleven-block types and all 1,066 tests. Public callback and licence boundaries remain unchanged. Its reviewed 6.0s film and paired opening poster retain the complete 820px workspace in 1400×940 source framing, showing typed DOC-404 evidence and the settled Done stamp and receipt. Maximum source gap is 29ms, changed-source delivery is 62.66ms and moving-frame p95 is 17.81ms, with no stalls and all guards retained. The earlier rejected native take remains archived. The four-block release checkpoint above covers this review. |
| `block-meetings-workspace` | current | current | Meetings Workspace now composes a full-width agenda, a retained host-owned room and independent notes with compact view names. Phone Join actions name the selected meeting, the call stage uses the accepted title, and notes retain their original meeting ID, including arriving opaque IDs. Empty notes and normalized day/meeting identities stay consistent. Pending join, leave and media actions await their host promises; rejected and retired requests preserve the current session, drafts and newer outside focus. Its 51-mount source review, forty accessibility audits and sixty reviewed state/entrance captures pass. Four fresh coarse-pointer mounts, twelve accessibility audits and twelve reviewed phone captures cover the shared 44px controls and narrow header correction. All nine Next block workflows, nine exact metadata replays, theme control, official audit and twelve measured Next/source framing captures pass with unchanged source hashes. Strict registry, root/all-eleven-block types and all 1,068 tests pass. The optional timezone prop labels host-supplied times; existing callback and Pro boundaries remain intact. Its reviewed 3.7s film and paired opening poster keep the complete 840px workspace at 1400x940, ending with Mara spotlighted and the hand raised. Source gap is 25ms, delivery 34.95ms and moving-frame p95 19.18ms, with no stalls and unchanged guards. |
