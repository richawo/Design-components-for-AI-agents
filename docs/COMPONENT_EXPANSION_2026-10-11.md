# Component expansion, 11 October 2026

Added 30 standalone React 19 and Tailwind v4 components: 12 free and 18 Pro. At completion, the catalog contained 180 components, split into 70 free and 110 Pro.

Curation update later on 11 October: Cart Drawer and Live Bento Grid moved from Free to Pro, and Sculpted Product Configurator was removed. The catalog now contains 179 components: 68 free and 111 Pro. The additions and validation below describe the original expansion.

The expansion fills practical gaps in input, navigation, scheduling, document management, developer tools, charts, commerce and editorial content. Every addition includes a typed named component, zero-prop demo, metadata, design prompt, structured JSON prompt, theme control, recorded interaction preview and poster.

## Additions

| Component | Tier | Category | Slug |
| --- | --- | --- | --- |
| Ruler Number Stepper | Free | inputs | `input-number-stepper` |
| Password Requirements | Free | inputs | `input-password-checklist` |
| Topic Tag Editor | Free | inputs | `input-tag-editor` |
| Brand Colour Swatches | Free | inputs | `input-color-swatches` |
| Folding Breadcrumb | Free | navigation | `navigation-breadcrumb-fold` |
| Windowed Pagination | Free | navigation | `navigation-pagination-window` |
| Editorial Question Index | Free | content | `content-accordion-index` |
| Editorial Empty Search | Free | feedback | `feedback-empty-search` |
| Actionable Inline Notice | Free | feedback | `feedback-inline-alert` |
| Milestone Progress Rail | Free | progress | `progress-milestones` |
| Response Style Radio Cards | Free | selects | `selects-radio-cards` |
| Shortcut Reference | Free | primitives | `primitives-shortcut-reference` |
| Source File Dropzone | Pro | inputs | `input-file-dropzone` |
| Keyboard Shortcut Recorder | Pro | inputs | `input-shortcut-recorder` |
| Booking Slot Selector | Pro | date-time | `date-booking-slots` |
| Weekly Agenda | Pro | date-time | `date-week-agenda` |
| Workspace Setup Checklist | Pro | onboarding | `onboarding-setup-checklist` |
| Communication Preferences | Pro | forms | `forms-preference-center` |
| Project File Explorer | Pro | data | `data-file-explorer` |
| Accessible Sprint Board | Pro | data | `data-kanban-compact` |
| Structured JSON Inspector | Pro | devtools | `devtools-json-inspector` |
| Request Timing Waterfall | Pro | devtools | `devtools-request-waterfall` |
| Before and After Comparator | Pro | media | `media-before-after` |
| Editorial Story Deck | Pro | media | `media-story-deck` |
| Bullet Target Comparison | Pro | charts | `chart-bullet-targets` |
| Change Waterfall Bridge | Pro | charts | `chart-waterfall-bridge` |
| Period Slope Comparison | Pro | charts | `chart-slope-comparison` |
| Sculpted Product Configurator (subsequently removed) | Pro | commerce | `commerce-product-configurator` |
| Editorial Event Ticket | Pro | cards | `cards-event-ticket` |
| Editorial Release Notes | Pro | content | `content-release-notes` |

## Design and implementation

The reference directories at [21st.dev](https://21st.dev/) and [UIARC](https://uiarc.dev/components/button) informed missing categories and interaction patterns. Implementations were written for this library, using its font roles, offline visuals and four-file component contract. No third-party component source was copied. The numeric input also follows the keyboard expectations in the [WAI-ARIA spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/).

Visual review covered dark and light themes, desktop and narrow containers, plus recorded interaction frames. Corrections included single-line weekday labels, a tag input that keeps its placeholder readable, aligned waterfall chart baselines, full-width request timing bars, focus restoration after breadcrumb and board changes, and complete framing of expanding agenda and ticket demos.

Behavioural hardening includes bounded numeric inputs, tiny decimal steps and overflow handling, IME-safe tag entry, independent native radio groups, file type and size validation, shortcut cancellation, booking selection invalidation when availability changes, and honest error feedback for rejected saves and cart actions. The JSON inspector handles circular references and limits depth, children and total rendered entries. A visible limit notice explains how collapsing earlier branches makes more entries available.

## Verification

- Strict registry validation and TypeScript checks pass.
- Unit tests: 25 files, 661 tests pass.
- All 30 additions pass the Chromium audit at 320, 390, 768, 1024, 1440 and 1920px. Light and dark touch layouts are also checked at 320 and 390px.
- The audit reports no runtime exceptions, document overflow, duplicate IDs, axe WCAG A/AA rule violations, or running animations after reduced motion settles in the tested states.
- All 30 pass two-instance mounting and empty-data checks. The documented collection props produce 60 empty-data scenarios.
- Every new component passes its metadata, control and recorded-demo check. All 30 MP4 previews are within the 3 to 8 second and 400 KB limits, with WebP posters.
- Two persistent browser regression suites were added to `npm run test:components`, alongside the ten existing suites. The Pro suite runs when the private component sources are checked out.
- The Node 24 production build passes. All 30 production previews return successfully, with no runtime errors or document overflow at 320px. All 12 browser regression suites pass with the production server.

Local evidence is in the ignored `test-results/expansion-20261011/` directory. `final-audit/` and `final-data/` contain the full sweep; `audit/<slug>/` and `data/<slug>/` contain the later agenda, tag-editor and waterfall corrections. `final-edge-audit/` and `final-edge-data/` verify the final JSON and booking fixes. Recorded-demo checks are under `test-results/check/<slug>/`; expanding agenda and ticket recordings were additionally framed in `final-videos/`.

The browser evidence is Chromium on macOS, including simulated touch. It does not establish Safari, Firefox, physical-device or screen-reader certification. Automated accessibility checks cover the exercised states; they are not a complete accessibility certification. Host callbacks remain responsible for real booking, persistence, upload and purchase operations.

## Delivery

Components were committed in separate, reviewable slices on the public and private repositories' `main` branches. Pro implementation source stays in the private repository; only its metadata and previews are mirrored publicly. Pre-existing user edits were preserved. This report describes repository delivery and local production-build verification, not a confirmed live Cloudflare deployment.
