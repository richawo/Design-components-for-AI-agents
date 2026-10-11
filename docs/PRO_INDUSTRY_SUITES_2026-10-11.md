# Pro industry suites, 11 October 2026

This batch adds eight Pro components for commerce, fashion, finance, HR and legal workflows. The catalogue now contains 187 components: 119 Pro and 68 free, or 63.6% Pro. Every new component in this batch is Pro. The long-term direction is approximately 90% Pro, reached by building useful paid workflows rather than treating the ratio as a release quota.

New additions default to Pro, and industry-specific additions belong in Pro. The existing free library remains a useful introduction to the product. These rules are recorded in [AGENTS.md](../AGENTS.md) and supersede the older allocation in [CATALOGUE_ROADMAP.md](CATALOGUE_ROADMAP.md).

## New components

| Component | Industry use | Working interaction |
| --- | --- | --- |
| [Audience Query Builder](https://design.yaps.ai/components/data-query-builder) | Commerce audiences; reusable business filtering | Typed conditions, all/any matching, live record counts, validation and an asynchronous apply callback. |
| [Catalogue Import Desk](https://design.yaps.ai/components/commerce-catalog-import) | E-commerce and fashion operations | CSV parsing, column mapping, required fields, duplicate SKU and value validation, review and acknowledged import. |
| [Fashion Variant Stockroom](https://design.yaps.ai/components/commerce-variant-stock) | Fashion inventory | Colour-by-size stock editing, low-stock indicators, totals, draft reset and acknowledged save. |
| [Order Returns Desk](https://design.yaps.ai/components/commerce-return-desk) | E-commerce and fashion service | Eligible item quantities, explicit reasons, refund/exchange/credit requests, review and a server-issued request reference. |
| [Settlement Reconciliation](https://design.yaps.ai/components/finance-reconciliation) | Finance and merchant operations | One statement entry to multiple ledger entries, reference matching, exact minor-unit differences and protection against reusing a matched entry. |
| [Team Capacity Planner](https://design.yaps.ai/components/hr-capacity-planner) | HR and resource planning | Daily team capacity, editable project allocations, quarter-hour validation, overbooking checks and acknowledged save. |
| [Document Revision Review](https://design.yaps.ai/components/legal-version-history) | Legal document review | Revision navigation, bounded line comparison, text and changes views, explicit restoration confirmation and preservation of revision history. |
| [Enterprise Permission Matrix](https://design.yaps.ai/components/app-permission-matrix) | Legal, HR and enterprise administration | Role-by-permission editing, fixed roles, transitive prerequisites, dependent revocation, bulk actions and acknowledged save. |

Each component has a typed React implementation, a complete demo, metadata, a design prompt, a structured JSON prompt, a theme control, an interaction recording and a poster. Pro implementation source and prompts remain in the private repository. Public metadata and previews support discovery.

## Suite coverage and next useful gaps

These are foundations for industry suites, not complete industry applications. Complementary components below already exist in Pro. Future work should connect meaningful user decisions and error recovery, rather than produce cosmetic variations of the same screen.

| Suite | Components that now work together | Next gaps to consider | Content supported by the shipped components |
| --- | --- | --- | --- |
| E-commerce | Catalogue import, audience filtering, Cart Drawer, Orders Table, returns and settlement reconciliation | Purchase orders, fulfilment exceptions, merchandising rules and promotion eligibility | Building a catalogue import flow; handling returns without losing customer choices; reconciling split settlements. |
| Fashion | Catalogue import, variant stockroom, Cart Drawer and returns | Size guides with merchant data, collection planning, preorder allocation and exchanges with live availability | Designing a colour-by-size inventory editor; handling variant quantities and fashion returns. |
| Finance | Settlement reconciliation, Billing Overview, Usage Forecast Cone and financial charts | Period-close tasks, cash-flow scenarios, expense review and variance explanations | Exact-money reconciliation interfaces; reviewable financial workflows with explicit acknowledgement. |
| HR | Team capacity planning, Weekly Agenda, Booking Slot Selector, setup checklist and permission matrix | Leave approvals, employee onboarding tasks, interview panels and policy acknowledgement | Team allocation and overbooking prevention; accessible role configuration. |
| Legal tech | Revision review, permission matrix, Project File Explorer, Rich Text Editor and Signature Pad | Obligation tracking, matter intake, signature request orchestration and clause libraries with provenance | Non-destructive revision review; dependency-aware permissions for matter teams. |

Content should demonstrate the working interfaces and their integration points. A signature pad alone is not an e-signature service, a permission editor does not enforce server authorization, and a return request receipt does not mean a refund was issued. Real product photography or merchant assets should represent actual goods; generated 3D shapes must not stand in for products.

The category directories at [21st.dev](https://21st.dev/community/components) and [UIARC](https://uiarc.dev/) informed the search for useful interaction patterns and workflow gaps. No third-party component source was copied.

## Verification

All eight components pass their strict registry, TypeScript, metadata/control and recorded-demo checks. The component audit covers 320, 390, 768, 1024, 1440 and 1920px, plus light and dark touch layouts at 320 and 390px. It reports no runtime errors, document overflow, duplicate IDs, axe rule violations or running animations after reduced motion settles in the tested states.

Two-instance mounting and 25 empty-collection cases pass separately. Persistent browser regressions cover parsing failures, invalid numeric inputs, exact large money values, rejected callbacks, saved-state reset, overbooking, revision bounds, confirmation, permission prerequisites and pending return requests when the order changes. Recordings are visually reviewed to ensure the demonstrated interaction completes and remains in frame. All eight recordings are 3 to 8 seconds and below 400 KB.

Live replay testing found and fixed a shared demo-player editing bug: replaying the replacement of `10` with `20` previously produced `1020`. Replay now applies cursor positioning and deletion, updates React controlled values, honours read-only fields and cancelled input, and respects text length limits. All eight new live demo sequences reach their intended completed states.

The unit suite passes 662 tests across 25 files, and the Node 24 production build passes. Local production and live-site checks both pass 74 anonymous access/discovery checks and eight 320px preview checks. These verify that catalogue and Markdown discovery label each addition Pro, private source endpoints remain locked, free registry downloads are absent, and the previews and media are available.

Local evidence is under the ignored `test-results/pro-workflows-20261011/` directory and `test-results/check/<slug>/`. Browser evidence is Chromium on macOS, including simulated touch. It does not establish Safari, Firefox, physical-device or screen-reader certification. Host integrations remain responsible for persistence, eligibility and authorization.

## Delivery

Each component was committed and pushed as a separate working slice on both repositories' `main` branches. The Pro default and industry policy, shared replay fix and suite documentation have their own commits. Existing unrelated local edits were preserved. Cloudflare's public and private commit identifiers confirm which sources are live at `/.well-known/design-build.json`.
