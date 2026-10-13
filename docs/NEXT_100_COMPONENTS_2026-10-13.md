# Next 100 components

Requested 13 October 2026. This is an implementation queue, not a claim that 100 components have shipped. Each row represents one focused interaction; variants of the same component do not count separately. All additions default to Pro under the current product policy.

The initial catalogue contains 248 components and 11 composed blocks. The slugs below were checked against that catalogue. Existing shell, node editor, player, story deck, tabs and input components were inspected when defining boundaries. Components must remain self-contained; future blocks compose the resulting catalogue rather than hiding new reusable controls inside a page.

## Reference direction

The following public pages were inspected visually in the browser on 13 October:

- [Lab01, experiment seven](https://lab01.dev/#ui-experiment-7): a narrow icon rail beside a contextual list, restrained surfaces and precise spacing. Apply this to navigation that changes its secondary context without losing the current selection.
- [21st.dev community](https://21st.dev/community/components): visual demonstrations lead the catalogue; material experiments and compact interactions are immediately inspectable. Borrow the presentation principle and develop our own behaviour and implementation.
- [Screenshots Club](https://screenshotsclub.xyz/app): app screenshot sequences make complete journeys inspectable. The How We Feel sequence shows expressive, semantic choices and quieter journal views. Apply those ideas to accessible native components and device demonstrations with host-owned content.
- [React Flow](https://reactflow.dev/): the landing hero is a functioning product demonstration, with parameters visibly connected to the output. Build lightweight live demonstrations rather than a screenshot beside marketing copy.
- [Phosphor](https://phosphoricons.com/): large, tactile icon objects introduce a practical search and customization tool. Make icon and geometry tools useful, with real output contracts.
- [UIArc](https://uiarc.dev/) and [UIArc Pro](https://uiarc.dev/pro): fine surface texture, lit edges, restrained glass and functioning showpieces. Glass must have a reason: overlapping content, physical separation or focus. It is not a default treatment for every panel.

The implementations, copy, marks and bundled artwork are original. Reference URLs identify visual direction, not code dependencies. Use the Design for AI MCP principles and `docs/COMPONENT_SPEC.md` as the release bar.

## Release gate

Each component includes typed host contracts, realistic offline defaults, code and both prompts, dark previews, a short meaningful demo and working customization controls. Check its applicable hover, focus, press, selected, disabled, loading, empty, error and success states. Preserve drafts and focus after failure. Animate figures in both directions and respect reduced motion. Custom interactions need keyboard and touch equivalents.

Validate all six web widths, both supported themes, multiple instances and empty inputs. Exercise real state transitions and rejected callbacks. Review screenshots and recordings; a 60 fps file alone does not prove smooth capture. Commit and push each verified component separately, including its public metadata and preview assets. Planned rows remain outside the published catalogue until they pass.

## 1. Tactile product foundations

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 1 | `navigation-context-rail` | navigation | Icon rail changes a second-level navigation list; remember each section's selection, collapse context, support a narrow-container drawer. | Released |
| 2 | `navigation-lens-dock` | navigation | Pointer-distance magnification and a moving glass lens; keyboard selection, disabled tools and touch remain stable. | Released |
| 3 | `cards-prismatic-folder` | cards | A translucent folder opens to its actual file list; preview, empty and unavailable content stay legible. | Released |
| 4 | `input-detent-dial` | inputs | A knurled rotary control with finite detents; drag, keys and precise numeric entry share one bounded value. | Released |
| 5 | `devtools-icon-workbench` | devtools | Search host-supplied SVG glyphs, adjust size and stroke, inspect and copy real SVG; clipboard failure is actionable. | Released |
| 6 | `hero-signal-workbench` | hero | Connected parameter nodes drive a live waveform preview; compare signals and adjust gain without a perpetual background loop. | Released |
| 7 | `button-shimmer-track` | buttons | A fine light travels the button edge; async actions preserve geometry through pending, success, failure and retry. | Released |
| 8 | `navigation-stacked-tabs` | navigation | Reorder, close and restore document tabs; retain dirty state and provide a keyboard move mode. | Released |
| 9 | `effect-border-tracer` | effects | A reusable perimeter light wraps host content; continuous or interaction-driven motion pauses offscreen and respects reduced motion. | Released |
| 10 | `layout-split-resizer` | navigation | Resize two content panes within supplied limits; collapse, restore and keyboard resizing preserve useful widths. | Released |

## 2. Media and product demonstration

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 11 | `media-device-switcher` | media | Inspect supplied content in phone, tablet and desktop frames with honest container dimensions. | Released |
| 12 | `media-image-contact-sheet` | media | Select and compare a dense image collection, with loading, missing assets and an empty selection. | Released |
| 13 | `media-focus-lightbox` | media | Zoom, pan and navigate supplied images; focus trapping, Escape, touch and an accessible static alternative. | Released |
| 14 | `media-trim-timeline` | media | Set in/out points on an audio waveform; bounded keyboard handles, exact time fields and a reviewed processing range. | Released |
| 15 | `media-spatial-collection` | media | Browse depth-layered album objects without obscuring labels; a list alternative supports keyboard and reduced motion. | Planned |
| 16 | `media-transcript-player` | media | Timed text follows actual playback, and selecting a passage seeks; unavailable media preserves the transcript. | Planned |
| 17 | `media-compare-grid` | media | Compare supplied variants with linked zoom and pan; independent viewing remains possible. | Planned |
| 18 | `portfolio-project-reel` | portfolio | A snap-based project reel with readable case notes and explicit previous/next controls. | Released |
| 19 | `media-crop-workbench` | editors | Resize and move an image crop with fixed-ratio options, reset and a normalized crop callback. | Released |
| 20 | `media-caption-styler` | editors | Edit caption typography against supplied footage and inspect safe-area, wrapping and contrast guides. | Planned |

## 3. Marketing that demonstrates

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 21 | `hero-layout-playground` | hero | A live layout constraint demo: move boundaries and see supplied content reflow within them. | Released |
| 22 | `features-integration-trace` | features | Follow a selected integration's data journey and inspect each transformation. | Planned |
| 23 | `features-shortcut-theatre` | features | Press accessible shortcut controls to demonstrate a product action in a supplied preview. | Planned |
| 24 | `features-compare-lenses` | features | Inspect two ways of completing one workflow with linked stages and honest differences. | Planned |
| 25 | `pricing-usage-calculator` | pricing | Estimate a bill from supplied rates and bounded quantities; explain included units and rounding. | Planned |
| 26 | `pricing-seat-simulator` | pricing | Model seat mixes and billing terms, with a transparent itemized total and no automatic checkout. | Planned |
| 27 | `social-proof-case-ledger` | social-proof | Browse supplied case outcomes alongside the evidence and time period that support each figure. | Planned |
| 28 | `content-interactive-spec` | content | Inspect a product specification by selecting annotated parts of a supplied diagram. | Planned |
| 29 | `cta-project-brief` | cta | A concise project brief folds into a reviewable submission with pending, failure and preserved input. | Planned |
| 30 | `footer-sitemap-atlas` | footers | A navigable site index with grouped destinations and a compact narrow-container treatment. | Planned |

## 4. Graphics and typography with purpose

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 31 | `text-optical-weight` | text | A variable-font specimen demonstrates weight and optical scale while retaining selectable text. | Planned |
| 32 | `text-path-typesetter` | text | Place accessible text along a supplied curve and adjust spacing without losing the reading order. | Planned |
| 33 | `text-number-odometer` | text | An interruptible numeric roll handles increases, decreases, signs, decimals and reduced motion. | Planned |
| 34 | `text-outline-fill` | text | Reading progress fills outlined lettering with a fully legible static fallback. | Planned |
| 35 | `bg-fluted-glass` | backgrounds | A refracted surface behind supplied content, with bounded quality, offscreen pause and static rendering. | Planned |
| 36 | `bg-topographic-contours` | backgrounds | Contour density and light angle respond to a bounded input; no uncontrolled ambient drift. | Planned |
| 37 | `pixel-halftone-image` | pixel | A host image becomes a controllable halftone specimen with meaningful density and threshold controls. | Planned |
| 38 | `effect-ink-trail` | effects | A pointer mark inside a bounded drawing region fades deliberately and leaves ordinary controls usable. | Planned |
| 39 | `three-material-inspector` | three-d | Inspect a generic material sample under adjustable light; compare metal, frost and matte using one object. | Planned |
| 40 | `three-exploded-assembly` | three-d | Separate labeled parts of a supplied generic assembly and restore them, with a complete diagram alternative. | Planned |

## 5. Difficult inputs and forms

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 41 | `input-dual-range` | inputs | Two bounded range handles with collision rules, numeric fields and keyboard equivalents. | Planned |
| 42 | `input-unit-converter` | inputs | Change a display unit without losing the underlying quantity or accepting invalid precision. | Planned |
| 43 | `input-cron-builder` | inputs | Compose a supported schedule and inspect its next occurrences in the chosen timezone. | Planned |
| 44 | `input-expression-editor` | inputs | Edit a small typed expression with syntax, validation and a transparent evaluated example. | Planned |
| 45 | `selects-tree-picker` | selects | Select hierarchical items with indeterminate parents, search and disabled-node explanations. | Planned |
| 46 | `date-range-calendar` | date-time | A two-ended date range with keyboard grid navigation, invalid-range recovery and locale-aware display. | Planned |
| 47 | `date-timezone-overlap` | date-time | Compare working hours across supplied zones and daylight-saving boundaries before choosing a time. | Planned |
| 48 | `forms-branching-survey` | forms | Conditional questions preserve prior answers when branches change and expose a final review. | Planned |
| 49 | `auth-recovery-codes` | auth | Reveal, copy and acknowledge supplied recovery codes; printing or downloading remains an explicit action. | Planned |
| 50 | `forms-draft-rescue` | forms | Compare a local draft with a newer host version, choose retained fields and acknowledge conflict resolution. | Planned |

## 6. Data exploration

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 51 | `chart-sunburst-explorer` | charts | Drill into a supplied hierarchy with an animated radial partition and an equivalent readable table. | Planned |
| 52 | `chart-sankey-paths` | charts | Select a source or destination to trace flow without hiding the remaining context. | Planned |
| 53 | `chart-box-distribution` | charts | Inspect medians, quartiles and outliers with accessible values and transparent sample sizes. | Planned |
| 54 | `chart-calendar-heatmap` | charts | Explore daily values with keyboard navigation, date filtering and an honest missing-data state. | Planned |
| 55 | `chart-scatter-brush` | charts | Select a bounded region of points and inspect the resulting records with keyboard filtering. | Planned |
| 56 | `chart-funnel-dots` | charts | Show discrete flow through stages while preserving exact totals and conversion denominators. | Planned |
| 57 | `data-pivot-configurator` | data | Choose dimensions and measures, then inspect a computed pivot and its empty or unsupported combination. | Planned |
| 58 | `data-column-workbench` | data | Reorder, pin and hide columns with a live table preview and keyboard movement. | Planned |
| 59 | `data-bulk-action-review` | data | Review exactly which selected records an action affects, including excluded and failed records. | Planned |
| 60 | `data-filter-history` | data | Compare, restore and name previous filter states without silently changing the active view. | Planned |

## 7. Creator and editor workflows

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 61 | `editor-layer-stack` | editors | Reorder, lock, hide and rename supplied layers; selection and move mode are keyboard accessible. | Planned |
| 62 | `editor-color-token-studio` | editors | Edit semantic color tokens and compare supplied foreground/background pairs with real contrast calculation. | Planned |
| 63 | `editor-spacing-inspector` | editors | Measure and change padding/gap on supplied content with bounded values and clear hit targets. | Planned |
| 64 | `editor-branch-compare` | editors | Compare two supplied document structures and explicitly accept or retain individual changes. | Planned |
| 65 | `editor-asset-license-sheet` | editors | Inspect supplied asset provenance and usage terms, then select an eligible asset for a project. | Planned |
| 66 | `editor-storyboard-strip` | editors | Reorder scene cards, adjust durations and inspect the cumulative sequence without exporting implicitly. | Planned |
| 67 | `editor-keyframe-track` | editors | Move discrete keyframes and inspect an interpolated property with a keyboard timeline alternative. | Planned |
| 68 | `editor-version-restore` | editors | Preview a saved version, compare its scope and request restoration with recoverable pending/failure states. | Planned |
| 69 | `editor-export-preset` | editors | Compose a valid export format, size and quality from host capabilities, then review the exact payload. | Planned |
| 70 | `editor-font-pairing` | editors | Compare host-provided font roles against actual supplied copy, with robust fallback and loading states. | Planned |

## 8. AI and delivery workflows

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 71 | `ai-context-budget` | ai | Inspect context sources and their token budget; include/exclude items with a clear over-limit explanation. | Planned |
| 72 | `ai-answer-compare` | ai | Compare supplied responses to the same request using shared evidence and explicit preference selection. | Planned |
| 73 | `ai-structured-output` | ai | Inspect streamed structured fields, distinguish incomplete values and recover validation errors. | Planned |
| 74 | `agents-dependency-board` | agents | Inspect task dependencies and blockers with a readable graph and a linear keyboard alternative. | Planned |
| 75 | `agents-run-replay` | agents | Scrub a supplied event history and reconstruct the visible run state without executing tools. | Planned |
| 76 | `agents-budget-guard` | agents | Review estimated and actual usage against supplied limits before authorizing a bounded action. | Planned |
| 77 | `devtools-release-compare` | devtools | Compare deployments, inspect changed resources and request a reviewed rollback. | Planned |
| 78 | `devtools-request-replay` | devtools | Edit a supplied request and inspect a host-provided response; cancellation rejects stale results. | Planned |
| 79 | `devtools-schema-migration` | devtools | Inspect a supplied migration plan, dependencies and impact before a host-owned apply request. | Planned |
| 80 | `devtools-incident-timeline` | devtools | Correlate supplied alerts, deploys and interventions on one timeline with filters and accessible event details. | Planned |

## 9. Native personal tools

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 81 | `mobile-mood-map` | mobile | Choose a semantic feeling from a spatial word map, refine it and save a user-owned check-in. | Planned |
| 82 | `mobile-habit-grid` | mobile | Record a habit on a date, correct a mistaken entry and inspect history without punitive streak copy. | Planned |
| 83 | `mobile-focus-session` | mobile | Start, pause and resume a timer using elapsed time rather than tick counts; handle app backgrounding. | Planned |
| 84 | `mobile-day-planner` | mobile | Reorder a bounded daily agenda and reschedule a task through accessible move controls. | Planned |
| 85 | `mobile-journal-prompt` | mobile | Expand a writing prompt into an editor, preserve the draft and handle acknowledged save failure. | Planned |
| 86 | `mobile-reading-progress` | mobile | Inspect chapter progress and bookmarks, with an explicit resume action and meaningful empty history. | Planned |
| 87 | `mobile-trip-itinerary` | mobile | Browse supplied travel legs with local timezone labels and inspect schedule changes. | Planned |
| 88 | `mobile-packing-list` | mobile | Group and check items, edit quantities and undo a completed-item removal. | Planned |
| 89 | `mobile-budget-envelope` | mobile | Allocate a supplied budget among categories with bounded totals and transparent remainder. | Planned |
| 90 | `mobile-voice-memo` | mobile | Inspect a host-supplied recording waveform, markers and transcript with real media callbacks. | Planned |

## 10. Native shared workflows

| # | Slug | Category | Distinct interaction and essential states | Status |
| --- | --- | --- | --- | --- |
| 91 | `mobile-project-switcher` | mobile | Choose or search a project in a tactile sheet; retain selection and show unavailable projects clearly. | Planned |
| 92 | `mobile-file-preview` | mobile | Inspect supplied file metadata and preview content, including loading, unsupported and unavailable states. | Planned |
| 93 | `mobile-attachment-tray` | mobile | Review selected attachments, limits and per-file failures before a host-owned send action. | Planned |
| 94 | `mobile-meeting-preflight` | mobile | Review host-reported audio/video readiness and join explicitly; no automatic permission requests. | Planned |
| 95 | `mobile-channel-thread` | mobile | Inspect a channel message and replies, preserve a response draft and acknowledge send results. | Planned |
| 96 | `mobile-task-move` | mobile | Move a supplied task between states with constraints, confirmation and undo where the host supports it. | Planned |
| 97 | `mobile-review-annotations` | mobile | Navigate supplied annotations over an asset with a readable list and touch-sized selection targets. | Planned |
| 98 | `mobile-notification-digest` | mobile | Group actionable notifications and acknowledge read or snooze changes without losing position. | Planned |
| 99 | `mobile-sync-conflict` | mobile | Compare local and remote values and review a field-level resolution with preserved edits. | Planned |
| 100 | `mobile-offline-outbox` | mobile | Inspect queued changes, retry failed entries and distinguish local drafts from host acknowledgements. | Planned |

## Progress

Planned: 83. Released: 17. Update a row to Released only after the private source and public metadata/assets have been verified and pushed.
