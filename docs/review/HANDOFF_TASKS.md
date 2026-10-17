# Handoff tasks for another agent

Self-contained work items from the paused review of the October component additions. Each task says what to do, where,
and how to know it's done. Pick any of them up independently. Background, briefs and tooling are in `docs/review/`
(start with `README.md`); per-component state is in `docs/review/STATUS.md`.

## Follow-up progress (17 October 2026)

- Task 3.1: resolved evidence chain verification and manifest flags. The dedicated browser probe passes, including missing hashes and rejected exports. The hash group’s invalid ARIA label is fixed, and isolated dark/light accessibility audits pass. The Next preview rerun is pending concurrent packed-source loader edits.

- Task 3.2: resolved invalid renewal dates and empty customer-health trends, with regression coverage for malformed and impossible dates.

- Task 3.3: resolved inconsistent warning thresholds and empty usage charts. Invalid policies remain explicit and saving is blocked until corrected. Compact chart handles also retain their full abbreviated values.

- Task 3.4: resolved pending/rejected undo, reader-swap routing and invalid triage timestamps. The regression probe and dark/light accessibility audits pass in isolation; official Next runner recheck remains pending the shared loader work.

- Task 3.5: resolved exhausted opening cash, singular month labels, scenario keyboard navigation and the empty scenario state. Saved projections and the rewritten browser probe pass in isolation, with clean dark/light accessibility checks.

- Tasks 3.6 and 3.7: resolved sender-specific printed payment links, host-only receipt links, and line removal at all widths. The invoice probe, dark/light accessibility checks and responsive captures at 320/390/768/1440 pass in isolation.

- Task 3.8: invalid due dates and unknown customers now produce a notice and are excluded from totals. Current and mixed invoice selections use accurate payment terms at every tone. The letter editor retains focus across draft changes. Source-fixture regression and theme/responsive checks are recorded with the component.

## Ground rules (read first)

- Two repos. Public: `richawo/Design-components-for-AI-agents` (this one). Pro: `richawo/Design-for-AI`, private, cloned
  into `registry/pro/`. Read `AGENTS.md` and `docs/COMPONENT_SPEC.md` before touching a component.
- **Work directly on `main`** in both repos. No branches or pull requests unless the owner asks. `git pull --rebase
  origin main` before starting and before pushing. Commit small, one component or one fix per commit, and push as you go.
- **Never push something broken.** Before each push: `node scripts/build-registry.mjs --strict`, `npx tsc --noEmit`
  (ignore errors under `.next/`), `npm test`. Never copy Pro source into the public repo.
- A Pro component's metadata lives in the public `registry/pro-manifest.json` (written by `build-registry`) and its guide
  in `content/components/guides.json`. Commit those in the public repo with the component. When several components are
  in flight, `docs/review/tools/commit-batch.sh` commits each slug with only its own manifest and guide entries.
- **Run one dev server and few browsers at once.** `npm run dev -- -p 3100`. The previous session ran eight agents on
  one server: it ran out of memory, reloaded previews constantly and captured blank posters. If a preview takes more
  than a few seconds to load, stop parallel work rather than retrying.
- Browser checks: `node scripts/check-component.mjs <slug> --base=http://localhost:3100 --no-video --keep-going`
  (screenshots at 1440/768/390 and every control flip; read the screenshots it writes to `test-results/check/<slug>/`).

## 1. Re-record demo videos (133 components)

Every rebuilt component's poster is current but its catalogue film (`public/previews/<slug>.mp4`) still shows the old
version. Record them one at a time on an otherwise idle machine; the recorder rejects frame stalls under load.

```sh
node scripts/record-demos.mjs <slug> --isolated-source --base=http://localhost:3100 --sheet=test-results/demo-sheets
```

Look at each contact sheet before committing: the film must be monochrome, show the component's idea within 3–8 s and
end settled. If a demo misbehaves, fix `meta.json` `demo` rather than the recording. Commit the mp4 (one commit per
slug or per small group). Notes:
- `legal-renewal-planner` drags its as-of line; check the drag registers. `commerce-shipping-estimator` and
  `commerce-customer-timeline` occasionally missed clicks under load; replay them.
- `navigation-lens-dock`'s poster at rest doesn't show the magnification; the video should.
- Demos that need a viewport bigger than the card can use `--frame-viewport` (see `docs/COMPONENT_QA.md`).

Slugs:

`mobile-attachment-tray`, `mobile-budget-envelope`, `mobile-channel-thread`, `mobile-focus-session`
`chart-box-distribution`, `chart-calendar-heatmap`, `chart-funnel-dots`, `chart-sankey-paths`
`chart-scatter-brush`, `chart-sunburst-explorer`, `data-bulk-action-review`, `data-column-workbench`
`data-filter-history`, `data-pivot-configurator`, `editor-asset-license-sheet`, `editor-branch-compare`
`editor-color-token-studio`, `editor-export-preset`, `editor-font-pairing`, `editor-keyframe-track`
`editor-layer-stack`, `editor-spacing-inspector`, `editor-storyboard-strip`, `editor-version-restore`
`three-exploded-assembly`, `three-material-inspector`, `agents-budget-guard`, `agents-dependency-board`
`agents-run-replay`, `ai-answer-compare`, `ai-context-budget`, `ai-structured-output`, `auth-recovery-codes`
`devtools-icon-workbench`, `devtools-incident-timeline`, `devtools-release-compare`, `devtools-request-replay`
`devtools-schema-migration`, `date-range-calendar`, `date-timezone-overlap`, `forms-branching-survey`
`forms-draft-rescue`, `input-cron-builder`, `input-detent-dial`, `input-dual-range`, `input-expression-editor`
`input-unit-converter`, `selects-tree-picker`, `saas-access-requests`, `saas-audit-trail`, `saas-customer-health`
`saas-integration-manager`, `saas-notification-inbox`, `saas-report-scheduler`, `saas-saved-views`
`saas-support-triage`, `saas-usage-policy`, `saas-workspace-dashboard`, `legal-clause-library`
`legal-document-requests`, `legal-evidence-index`, `legal-matter-dashboard`, `legal-matter-intake`
`legal-obligation-tracker`, `legal-renewal-planner`, `legal-signature-request`, `hr-compensation-review`
`hr-employee-onboarding`, `hr-interview-scorecard`, `hr-leave-approval`, `hr-org-explorer`, `hr-people-dashboard`
`hr-policy-acknowledgement`, `hr-shift-coverage`, `finance-close-checklist`, `finance-expense-review`
`finance-invoice-composer`, `finance-payment-run`, `finance-receivables-aging`, `finance-reconciliation`
`finance-scenario-forecast`, `fashion-assortment-planner`, `fashion-exchange-selector`, `fashion-launch-calendar`
`fashion-wholesale-order`, `commerce-backorder-allocation`, `commerce-bundle-builder`
`commerce-customer-timeline`, `commerce-shipping-estimator`, `layout-split-resizer`, `layout-workspace-shell`
`scroll-background-wipe`, `scroll-chapter-stack`, `scroll-cinema-frame`, `bg-fluted-glass`
`bg-topographic-contours`, `button-shimmer-track`, `cards-prismatic-folder`, `collab-call-stage`
`collab-message-list`, `content-interactive-spec`, `cta-project-brief`, `effect-border-tracer`, `effect-ink-trail`
`features-compare-lenses`, `features-integration-trace`, `features-shortcut-theatre`, `footer-sitemap-atlas`
`hero-layout-playground`, `hero-signal-workbench`, `media-audio-transport`, `media-caption-styler`
`media-compare-grid`, `media-crop-workbench`, `media-device-switcher`, `media-focus-lightbox`
`media-image-contact-sheet`, `media-spatial-collection`, `media-track-list`, `media-transcript-player`
`media-trim-timeline`, `navigation-context-rail`, `navigation-lens-dock`, `navigation-stacked-tabs`
`pixel-halftone-image`, `portfolio-project-reel`, `pricing-seat-simulator`, `pricing-usage-calculator`
`social-proof-case-ledger`, `text-number-odometer`, `text-optical-weight`, `text-outline-fill`
`text-path-typesetter`

## 2. Retake 9 stale posters

These posters still show the previous UI because the server was overloaded:
`saas-saved-views`, `saas-integration-manager`, `saas-access-requests`, `saas-audit-trail`, `saas-workspace-dashboard`,
`saas-notification-inbox`, `finance-reconciliation`, `finance-expense-review`, `finance-close-checklist`.

`node scripts/screenshot.mjs <slug> --base=http://localhost:3100`, then open the webp and check it isn't blank or
mid-entrance. While there, run `check-component` on each and confirm two things left unverified:
- `saas-access-requests`: the theme → light control flip was reported as changing nothing (probably a reload during the
  check). Confirm it, fix if real.
- `saas-audit-trail`: the histogram bars' transform origin was changed to `originY: 1` at the last minute and never
  seen rendered. Confirm the bars draw up from the baseline.

## 3. Fix component bugs found by the new browser probes

Each was found by a rewritten probe in `tests/browser/pro-50/`; four of those probes fail on purpose until fixed.
Fix the component (in `registry/pro/<slug>/`), keep its prompts and `meta.json` accurate, make the probe pass, commit
the Pro fix and push both repos. Run a probe with `PREVIEW_BASE=http://localhost:3100 node
tests/browser/pro-50-<suite>-probe.mjs <slug>` (suite = legal, saas, finance, hr, fashion, commerce).

1. **legal-evidence-index**: an exhibit with no hashed hand-offs (`custody: []`, or events without `sha256`) shows
   "Matches at all 0 recorded hand-offs" and counts toward "chains intact". Nothing compared means no match claimed:
   show an unverified state. Also the footer says a broken exhibit "will be flagged in the manifest" but the export
   payload has no flag; either add one (`broken: true` on the manifest entry, documented) or change the copy.
2. **saas-customer-health**: `renewsOn: "not-a-date"` crashes the page (`RangeError: Invalid time value`). Guard dates
   and report bad records in the existing invalid-data alert. `trend: []` draws NaN SVG paths and "Health, last 0
   weeks"; show an empty trend state.
3. **saas-usage-policy**: a host policy with `warnAt` above `limit` is accepted silently. Clamp or flag it in the
   invalid-data alert. `daily: []` draws a path without a moveto (console error); render an empty chart state.
4. **saas-support-triage**: if `onUndo` rejects, the rejection is unhandled, there is no alert, and the ticket has
   already been put back. Make undo pending until the host resolves, show the alert on failure and keep the routed
   state. `receivedAt: "yesterday"` renders "NaNd"/"NaN:NaN"; validate times. Race: clicking a route button within
   the ~150 ms reader crossfade after picking another ticket routes the previous ticket (the exiting reader keeps its
   `selected`); route by the ticket id captured at click time, or make the exiting reader inert.
5. **finance-scenario-forecast**: a negative opening balance makes the runway null, so it reads "12+ months / Not
   before …" as if cash never runs out. Show runway 0 / cash already out. Also: "1 months" pluralisation, the
   scenario tablist has no arrow-key support, and `scenarios=[]` renders nothing (needs an empty state).
6. **finance-invoice-composer**: the pay-online line on the invoice and the receipt's payment link are hard-coded to
   the demo company's `pay.fernhill.studio/…` whatever `sender` is passed, and the receipt invents a link when the
   host returns no `paymentUrl`. Derive it from props (e.g. a `paymentLinkBase` prop or the returned URL only) and omit
   it when there is none.
7. **finance-invoice-composer**: "Remove line" buttons are `hidden @2xl:grid`, so below a 672px container lines can't
   be removed. Make removal reachable at every width.
8. **finance-receivables-aging**: ticking an invoice that isn't yet due writes "… is now 0 days past due"; reword for
   not-yet-due invoices. Also an invalid `dueDate` is silently aged as "Over 90 days", and an invoice whose customer
   isn't in `customers` counts in the totals without a row; report both in an invalid-data notice.

## 4. Finish or rerun browser probes

- **Run for the first time end to end** (written, never completed because the server was overloaded):
  `finance-scenario-forecast`, `finance-invoice-composer`, `finance-payment-run`, `finance-receivables-aging`. They
  assert bugs 5–8 above, so fix those first or expect those assertions to fail. Fix any probe-side mistakes you find.
- **Rerun on the official runner** (passed in an isolated harness or before a formatting-only pass):
  `hr-leave-approval`, `hr-people-dashboard`, `hr-interview-scorecard`, `hr-policy-acknowledgement`,
  `commerce-customer-timeline`, `commerce-backorder-allocation`, `commerce-bundle-builder`,
  `commerce-shipping-estimator`, and `saas-support-triage` (its last edit wasn't rerun).
- **Update cross-cutting probes that still assert old UIs** (all in `tests/browser/`):
  - `pro-50-demo-probe.mjs`: `finalStates` holds old receipt texts for several slugs (e.g. fashion-exchange-selector
    now ends on "Exchange confirmed"). Replay each slug's `meta.demo` and update the expected final text.
  - `pro-native-themes-probe.mjs`: fashion-exchange-selector no longer has native inputs; drop or replace it, and
    check every other listed slug still has what the probe expects.
  - `preview-cascade-probe.mjs`: uses fashion-launch-calendar's old Instrument Serif `h2` and `data-demo="day-20"` as
    its vehicle; pick a component that still has a serif heading and a stable target, or rewrite the assertions.
  - `audit-trail-polish-probe.mjs`: drives the old "Date range" panel and diff field headings of saas-audit-trail.
  - `pro-industry-probe.mjs` and `pro-demo-probe.mjs`: test the old finance-reconciliation ("Select same reference",
    "Record match"). The new one matches by clicking a statement line then a ledger entry, or Auto-match.
  - `pro-scroll-probe.mjs`: its video section fails even on old code because this Chromium can't decode the H.264 test
    mp4. Add a webm source to the fixture (the probe's contract passes with a webm).
  - The `block-legal-workspace` block probe fails identically before and after the workspace-shell rebuild; find the
    pre-existing cause.
- Then run the whole suite: `npm run test:components` with the dev server up, and make it green.

## 5. Write browser probes for components that have none

101 finished components have no dedicated browser regression probe. For each, read its source and
`meta.json`, then add a case to the appropriate `tests/browser/*.mjs` suite (or a new probe registered in
`scripts/test-components.mjs`) covering: the signature interaction, keyboard paths, failed-then-successful callbacks
with drafts kept (where it has async callbacks), and empty or invalid data. Use `tests/browser/pro-50/hr-org-explorer.mjs`
as the model for style and depth. Mobile components render through React Native web (`scripts/lib/component-fixture.mjs` aliases it);
see `tests/browser/mobile-accessibility-probe.mjs` for a native example.

`mobile-attachment-tray`, `mobile-budget-envelope`, `mobile-channel-thread`, `mobile-day-planner`
`mobile-file-preview`, `mobile-focus-session`, `mobile-habit-grid`, `mobile-journal-prompt`
`mobile-meeting-preflight`, `mobile-mood-map`, `mobile-notification-digest`, `mobile-offline-outbox`
`mobile-packing-list`, `mobile-project-switcher`, `mobile-reading-progress`, `mobile-review-annotations`
`mobile-sync-conflict`, `mobile-task-move`, `mobile-trip-itinerary`, `mobile-voice-memo`, `chart-box-distribution`
`chart-calendar-heatmap`, `chart-funnel-dots`, `chart-sankey-paths`, `chart-scatter-brush`
`chart-sunburst-explorer`, `data-bulk-action-review`, `data-column-workbench`, `data-filter-history`
`data-pivot-configurator`, `editor-asset-license-sheet`, `editor-branch-compare`, `editor-color-token-studio`
`editor-export-preset`, `editor-font-pairing`, `editor-keyframe-track`, `editor-layer-stack`
`editor-spacing-inspector`, `editor-storyboard-strip`, `editor-version-restore`, `three-exploded-assembly`
`three-material-inspector`, `agents-budget-guard`, `agents-dependency-board`, `agents-run-replay`
`ai-answer-compare`, `ai-context-budget`, `ai-structured-output`, `auth-recovery-codes`, `devtools-icon-workbench`
`devtools-incident-timeline`, `devtools-release-compare`, `devtools-request-replay`, `devtools-schema-migration`
`date-range-calendar`, `date-timezone-overlap`, `forms-branching-survey`, `forms-draft-rescue`
`input-cron-builder`, `input-detent-dial`, `input-dual-range`, `input-expression-editor`, `input-unit-converter`
`selects-tree-picker`, `layout-split-resizer`, `bg-fluted-glass`, `bg-topographic-contours`
`button-shimmer-track`, `cards-prismatic-folder`, `collab-message-list`, `content-interactive-spec`
`cta-project-brief`, `effect-border-tracer`, `effect-ink-trail`, `features-compare-lenses`
`features-integration-trace`, `features-shortcut-theatre`, `footer-sitemap-atlas`, `hero-layout-playground`
`hero-signal-workbench`, `media-caption-styler`, `media-compare-grid`, `media-crop-workbench`
`media-device-switcher`, `media-focus-lightbox`, `media-image-contact-sheet`, `media-spatial-collection`
`media-transcript-player`, `media-trim-timeline`, `navigation-context-rail`, `navigation-lens-dock`
`navigation-stacked-tabs`, `pixel-halftone-image`, `portfolio-project-reel`, `pricing-seat-simulator`
`pricing-usage-calculator`, `social-proof-case-ledger`, `text-number-odometer`, `text-optical-weight`
`text-outline-fill`, `text-path-typesetter`

## 6. Finish nine parked rebuilds

Rebuilt but not shipped; the live components are still the old versions. Each lives in the Pro repo at
`registry/pro/_wip/<slug>/` with `component.patch`, `guide.json` and sometimes `probe.mjs`. To resume one:

```sh
git -C registry/pro apply _wip/<slug>/component.patch
# merge _wip/<slug>/guide.json into content/components/guides.json under "<slug>"
# copy _wip/<slug>/probe.mjs to tests/browser/pro-50/<slug>.mjs if present
```

Then finish it to `docs/review/REVIEW_BRIEF.md` and its suite language (`docs/review/suites/`), refresh the poster,
run the checks, and delete `_wip/<slug>` in the Pro commit that ships it.

| Slug | What's missing |
| --- | --- |
| fashion-preorder-planner | `prompt.md`/`prompt.json` still describe the old design; probe; poster |
| fashion-collection-line-plan | prompts; probe; poster; check `block-fashion-workspace` renders |
| fashion-merchandising-dashboard | prompts; probe; poster; check `block-fashion-workspace` renders |
| fashion-size-guide | prompts; the probe's last remount (missing values, empty data) unverified; native-themes probe; poster |
| scroll-image-curtain | `pro-scroll-probe` "follows native scroll" not yet passing; visual check; poster |
| scroll-horizontal-showcase | visual check; live demo check; poster (scroll probe passed) |
| scroll-expanding-mosaic | poster captured blank; scroll probe's change and reversal checks not passing on final code |
| finance-budget-variance | no visual check at all; probe not passing on final code; poster |
| finance-cashflow-dashboard | probe not rerun after a test fix; the last change (list scrolls to selected week) uncaptured |

## 7. Continue the review (about 40 components, then 12 blocks)

Same process as the 149 already done: hold each to the first ~100 components' standard. Briefs:
`docs/review/REVIEW_BRIEF.md`, `docs/review/SUITE_BRIEF.md` for industry components, suite languages in
`docs/review/suites/`. Work newest first, about four components per batch, and verify each (build, tsc, tests,
check-component, your own captures of states and mid-entrance frames, a refreshed poster, a rewritten pro-50 probe for
industry components).

- **Commerce** (copy `suites/commerce.md`): commerce-promotion-builder, commerce-purchase-order,
  commerce-fulfilment-desk, commerce-operations-dashboard, commerce-return-desk, commerce-variant-stock,
  commerce-catalog-import. `block-commerce-workspace` imports commerce-return-desk: keep its call site working.
- **Others**: app-permission-matrix, legal-version-history (`suites/legal.md`), hr-capacity-planner (`suites/hr.md`),
  data-query-builder.
- **Smaller components** (#151–179): chart-waterfall-bridge, content-release-notes, cards-event-ticket,
  chart-slope-comparison, chart-bullet-targets, media-story-deck, devtools-request-waterfall, devtools-json-inspector,
  media-before-after, data-kanban-compact, data-file-explorer, forms-preference-center, date-week-agenda,
  onboarding-setup-checklist, date-booking-slots, input-file-dropzone, input-shortcut-recorder,
  feedback-empty-search, navigation-pagination-window, primitives-shortcut-reference, selects-radio-cards,
  progress-milestones, content-accordion-index, feedback-inline-alert, navigation-breadcrumb-fold,
  input-color-swatches, input-tag-editor, input-password-checklist, input-number-stepper.
- **Blocks**, after their parts: the 12 `block-*` components. Many parts changed their look and some their props;
  re-check each block composes well with the rebuilt parts and still reads as one product.

## 8. Final release checks

After any batch of the above: `node scripts/build-registry.mjs --strict`, `npx tsc --noEmit`, `npm test`,
`npm run test:components`, `npm run audit:components -- <changed slugs>`, then stop the dev server and run
`npm run deploy:dry-run` to check the Worker bundle size. Deployment itself (`npm run deploy`) is the owner's call.

## Lessons from the last run

- `AnimatePresence initial={false}` around first-render content suppresses the whole subtree's entrance. Avoid it.
- `AnimatePresence mode="wait"` can stall when its key changes during an exit; prefer keyed entrance-only swaps.
- The demo player can't drive native range inputs; give range what-ifs a clickable equivalent for `meta.demo`.
- Infinite CSS animations and large `backdrop-filter`s starve frames under software rendering and fail recording.
- CountUp renders its value twice (an aria-hidden copy and an sr-only copy); probe assertions must allow for it.
