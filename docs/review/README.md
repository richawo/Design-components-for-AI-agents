# Review of the October additions: handoff

In October 2026 about 290 components were added by another model in one pass. The owner asked for a solid review,
newest first, fixing each one up to the standard of the first ~100 components. This folder lets a later session pick
that work up where it paused (17 October 2026).

## How the review works

- `REVIEW_BRIEF.md` is the brief each rebuild agent received: the standard, what was wrong, rules, verification and
  report format. `SUITE_BRIEF.md` adds the bar for the industry suites (SaaS, legal, HR, finance, fashion, commerce).
  `MOBILE_BRIEF.md` and `MOBILE_BRIEF_2.md` hold the React Native web gotchas for mobile components.
- `suites/<suite>.md` is each suite's shared visual language. Components in a suite copy its tokens and helpers
  verbatim from the components named there, so the suite reads as one product.
- Agents work in batches of about four slugs, never commit, and report back. The lead reviews posters and state
  sheets, then commits each component separately in both repositories with `tools/commit-batch.sh`, which uses
  `tools/pick.mjs` to stage only that slug's entries in `registry/pro-manifest.json` and `content/components/guides.json`.
- Unfinished rebuilds are parked with `tools/save-wip.sh <slug>`: the work is saved under `registry/pro/_wip/<slug>/`
  (private repo) and the live component stays at its last good version.

## Status at the pause

Work another agent can pick up, task by task, is in `HANDOFF_TASKS.md`.

Done (rebuilt, verified, committed): 149 components. The full list, with what each still needs, is in
`STATUS.md`.

Parked in `registry/pro/_wip/` (rebuilt but unfinished; apply the patch, finish, verify, commit):

| Slug | What's missing |
| --- | --- |
| fashion-preorder-planner, fashion-collection-line-plan, fashion-merchandising-dashboard | prompt.md/prompt.json describe the old design; probes not rewritten; poster |
| fashion-size-guide | prompts; probe written (`probe.mjs`) but its last section unverified; poster |
| scroll-image-curtain | `pro-scroll-probe` not passing yet (timed out under load); visual check; poster |
| scroll-horizontal-showcase | visual check and live demo check; poster (its scroll probe passed) |
| scroll-expanding-mosaic | poster captured blank; `pro-scroll-probe` not passing on the final code |
| finance-budget-variance | no visual check at all; probe (`probe.mjs`) not passing on the final code; poster |
| finance-cashflow-dashboard | probe (`probe.mjs`) not rerun after a test fix; last change (scroll to week) uncaptured; poster |

Resume a parked slug from the public repo root:

```sh
git -C registry/pro apply _wip/<slug>/component.patch
# merge _wip/<slug>/guide.json into content/components/guides.json under "<slug>"
# copy _wip/<slug>/probe.mjs to tests/browser/pro-50/<slug>.mjs if present
```

Then finish it against the brief, and delete `_wip/<slug>` in the commit that ships it.

## Original assignment

The lists below record the starting assignment. See `HANDOFF_TASKS.md` and `STATUS.md` for current completion and remaining queues.

Commerce and others (Pro): commerce-promotion-builder, commerce-purchase-order, commerce-fulfilment-desk,
commerce-operations-dashboard, commerce-return-desk, commerce-variant-stock, commerce-catalog-import (copy
`suites/commerce.md`), app-permission-matrix, legal-version-history (`suites/legal.md`), hr-capacity-planner
(`suites/hr.md`), data-query-builder.

Blocks (review after their parts): the 11 published `block-*` components. The original count of twelve was stale; the source and metadata inventory was reconciled on 19 October.

Smaller components (#151–179): chart-waterfall-bridge, content-release-notes, cards-event-ticket,
chart-slope-comparison, chart-bullet-targets, media-story-deck, devtools-request-waterfall, devtools-json-inspector,
media-before-after, data-kanban-compact, data-file-explorer, forms-preference-center, date-week-agenda,
onboarding-setup-checklist, date-booking-slots, input-file-dropzone, input-shortcut-recorder, feedback-empty-search,
navigation-pagination-window, primitives-shortcut-reference, selects-radio-cards, progress-milestones,
content-accordion-index, feedback-inline-alert, navigation-breadcrumb-fold, input-color-swatches, input-tag-editor,
input-password-checklist, input-number-stepper.

## Follow-ups after the review

- **Videos.** Agents refreshed posters only. Re-record `public/previews/<slug>.mp4` serially on a quiet machine
  (`node scripts/record-demos.mjs <slug> --isolated-source`) for every slug marked in `STATUS.md`.
- **Posters.** A few posters could not be refreshed because the dev server was overloaded; `STATUS.md` marks them.
  Retake with `node scripts/screenshot.mjs <slug>`.
- **Browser probes.** `tests/browser/pro-50/<slug>.mjs` was rewritten for most rebuilt industry components;
  `STATUS.md` says which. Cross-cutting probes still assert old UIs: `tests/browser/pro-50-demo-probe.mjs`
  (`finalStates`), `pro-native-themes-probe.mjs` (fashion-exchange-selector has no native inputs now),
  `preview-cascade-probe.mjs` (uses the old fashion-launch-calendar) and `audit-trail-polish-probe.mjs`.
- **Final checks.** `node scripts/build-registry.mjs --strict`, `npx tsc --noEmit`, `npm test`,
  `npm run test:components`, `npm run deploy:dry-run`.

## Lessons from this run

- Many agents on one dev server overload it: previews reload on every edit and posters capture blank. Keep it to a
  few agents, and take posters and probes when the server is quiet.
- Don't wrap first-render content in `AnimatePresence initial={false}`: it suppresses the subtree's entrance.
- The demo player can't drive native range inputs; give range what-ifs a clickable equivalent.
- Infinite animations and large `backdrop-filter` starve frames under software rendering and fail video recording.
