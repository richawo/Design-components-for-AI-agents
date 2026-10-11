# Pro expansion: 50 workflows and six scroll components

Requested on 11 October 2026. All entries below are new Pro components. The target is eight additions in each of e-commerce, fashion, finance, HR and legal tech, plus ten shared SaaS components. Each suite includes a dashboard and substantial working workflows. All 50 entries have been implemented, individually verified, committed and pushed. Six additional Pro scroll components complete the follow-up request.

Each entry ships with a self-contained typed implementation, design prompts, both themes, documented data contracts and a recorded interaction. Applicable write actions use host callbacks with explicit pending, success and failure states. Every component received visual review, responsive and automated accessibility audits, empty-data and multiple-instance checks, and behaviour regressions. The six dashboards cover commerce, merchandising, cash position, people, legal matters and a general SaaS workspace.

| Suite | Component | Distinct interaction |
| --- | --- | --- |
| commerce | Commerce Operations Dashboard (`commerce-operations-dashboard`) | Channel performance, conversion funnel and an exception drill-down. |
| commerce | Fulfilment Exception Desk (`commerce-fulfilment-desk`) | Select a shipment, inspect blockers and submit a recovery action. |
| commerce | Purchase Order Composer (`commerce-purchase-order`) | Supplier order lines with quantity, unit cost, totals and review. |
| commerce | Promotion Rule Studio (`commerce-promotion-builder`) | Configure eligibility, discount caps and a basket preview. |
| commerce | Shipping Rate Workbench (`commerce-shipping-estimator`) | Compare eligible services from destination, parcel weight and order value. |
| commerce | Product Bundle Builder (`commerce-bundle-builder`) | Assemble a bundle with inventory-aware quantities and transparent savings. |
| commerce | Backorder Allocation Desk (`commerce-backorder-allocation`) | Distribute incoming inventory without exceeding supply or demand. |
| commerce | Customer Order Timeline (`commerce-customer-timeline`) | Search customers and inspect order, refund and service history. |
| fashion | Merchandising Dashboard (`fashion-merchandising-dashboard`) | Collection performance with size demand, sell-through and category drill-down. |
| fashion | Collection Line Plan (`fashion-collection-line-plan`) | Edit style counts and target costs within a collection budget. |
| fashion | Garment Size Guide Studio (`fashion-size-guide`) | Editable garment measurements with centimetre and inch previews. |
| fashion | Preorder Production Planner (`fashion-preorder-planner`) | Plan size-level production against preorders and minimum factory quantities. |
| fashion | Variant Exchange Selector (`fashion-exchange-selector`) | Choose an available replacement and review the exact price difference. |
| fashion | Store Assortment Planner (`fashion-assortment-planner`) | Allocate a size run across stores within a stock and shelf budget. |
| fashion | Collection Launch Calendar (`fashion-launch-calendar`) | Filter release milestones and inspect readiness before scheduling. |
| fashion | Wholesale Order Sheet (`fashion-wholesale-order`) | Order size packs with minimum quantities, availability and line totals. |
| finance | Cash Position Dashboard (`finance-cashflow-dashboard`) | Account balances and cash movements with period and account inspection. |
| finance | Period Close Workspace (`finance-close-checklist`) | Dependency-aware close tasks with ownership and completion evidence. |
| finance | Expense Review Desk (`finance-expense-review`) | Review receipts, policy exceptions and explicit approval or return decisions. |
| finance | Budget Variance Explorer (`finance-budget-variance`) | Compare actuals with plans and explain selected variances. |
| finance | Invoice Draft Studio (`finance-invoice-composer`) | Line items, discounts and explicit tax rates with exact totals and review. |
| finance | Receivables Aging Board (`finance-receivables-aging`) | Overdue buckets, customer balances and a reviewed follow-up request. |
| finance | Cash Flow Scenario Planner (`finance-scenario-forecast`) | Adjust income, fixed cost and growth assumptions with a transparent projection. |
| finance | Payment Run Review (`finance-payment-run`) | Select payable invoices within a funding limit and create a reviewed batch. |
| hr | People Operations Dashboard (`hr-people-dashboard`) | Headcount, department distribution and upcoming employee milestones. |
| hr | Leave Approval Workspace (`hr-leave-approval`) | Inspect requests, remaining allowance and coverage before a decision. |
| hr | Employee Onboarding Journey (`hr-employee-onboarding`) | Role-specific onboarding tasks with owners, prerequisites and progress. |
| hr | Interview Scorecard (`hr-interview-scorecard`) | Anchored competency ratings, evidence notes and explicit recommendation. |
| hr | Policy Acknowledgement Desk (`hr-policy-acknowledgement`) | Read a versioned policy and acknowledge the exact revision. |
| hr | Organisation Explorer (`hr-org-explorer`) | Search a bounded reporting hierarchy and inspect each person’s team. |
| hr | Compensation Review Sheet (`hr-compensation-review`) | Propose salary adjustments with range guidance and a shared increase budget. |
| hr | Shift Coverage Board (`hr-shift-coverage`) | Assign qualified staff while checking conflicts and weekly hour limits. |
| legal | Matter Operations Dashboard (`legal-matter-dashboard`) | Matter workload, upcoming dates and a selected matter’s status and owner. |
| legal | Matter Intake Workspace (`legal-matter-intake`) | Structured client intake with parties, jurisdiction and conflict-check handoff. |
| legal | Contract Obligation Tracker (`legal-obligation-tracker`) | Filter duties by owner and due date and record completion evidence. |
| legal | Signature Request Composer (`legal-signature-request`) | Prepare a document, signer order and reviewed signature-request payload. |
| legal | Clause Library Browser (`legal-clause-library`) | Search approved clauses, inspect provenance and insert a chosen revision. |
| legal | Evidence Index Workspace (`legal-evidence-index`) | Search exhibit metadata, inspect custody events and curate an export manifest. |
| legal | Contract Renewal Planner (`legal-renewal-planner`) | Inspect renewal terms and record an owner’s decision before a supplied deadline. |
| legal | Document Request Portal (`legal-document-requests`) | Track requested documents, validate selected files and await upload acknowledgement. |
| saas | Workspace Command Centre (`saas-workspace-dashboard`) | Workspace activity, adoption and projects with a real team filter. |
| saas | Notification Triage Inbox (`saas-notification-inbox`) | Filter, inspect and mark notifications read without losing selection. |
| saas | Audit Trail Explorer (`saas-audit-trail`) | Filter immutable events and inspect actor, target and before/after details. |
| saas | Integration Connection Manager (`saas-integration-manager`) | Browse integrations and manage acknowledged connection state. |
| saas | Access Request Queue (`saas-access-requests`) | Inspect justification and grant a bounded duration or decline a request. |
| saas | Saved View Organiser (`saas-saved-views`) | Create, rename, pin and reorder validated saved filter views. |
| saas | Support Triage Workspace (`saas-support-triage`) | Prioritise tickets, assign ownership and save a response draft. |
| saas | Report Delivery Scheduler (`saas-report-scheduler`) | Configure report sections, recipients, timezone and cadence with review. |
| saas | Usage Limit Policy Editor (`saas-usage-policy`) | Configure warning and hard limits with a live consumption preview. |
| saas | Customer Health Board (`saas-customer-health`) | Inspect transparent health signals and record the next customer action. |

The earlier [suite foundations](PRO_INDUSTRY_SUITES_2026-10-11.md) remain part of these suites. Category and workflow inspiration comes from [21st.dev](https://21st.dev/community/components) and [UIARC](https://uiarc.dev/); implementations are original.


## Scroll additions

| Component | Behaviour |
| --- | --- |
| Expanding Scroll Mosaic (`scroll-expanding-mosaic`) | A contact sheet expands its lead image to fill the viewport; reduced motion presents the complete gallery. |
| Scroll Cinema Frame (`scroll-cinema-frame`) | A centred video frame expands with scroll, with native controls, optional captions and offscreen pause. |
| Scroll Background Wipe (`scroll-background-wipe`) | A circular reveal changes the complete scene and its typography together, preserving contrast. |
| Scroll Chapter Stack (`scroll-chapter-stack`) | Sticky editorial chapters layer during scrolling; long content, small screens and reduced motion use ordinary flow. |
| Horizontal Scroll Showcase (`scroll-horizontal-showcase`) | Vertical page progress moves through a horizontal project sequence; mobile and reduced motion stack the projects. |
| Scroll Image Curtain (`scroll-image-curtain`) | Two panels open to reveal an image; an opaque control can reveal it or return to the cover. |

These use native document scrolling with no wheel interception, flashing or perpetual animation. Scroll effects reverse naturally. Changing the system motion preference while the component is mounted switches to the complete static layout. The standalone demos use local abstract artwork; host applications can supply authentic images and video.

## Verification and integration boundaries

- All 56 component audits passed at 320, 390, 768, 1024, 1440 and 1920 pixels, with additional 320px touch checks in both themes. The audit checks runtime errors, horizontal overflow, duplicate IDs, automated accessibility rules and reduced-motion animations.
- Desktop, tablet and phone screenshots and recorded interaction contact sheets were visually reviewed. Empty array inputs and multiple instances were exercised separately.
- Browser regressions cover all 50 workflow components and the six scroll patterns. They exercise valid actions, invalid inputs, callback rejection and retry where applicable, calculated boundaries, keyboard interaction and selection persistence.
- All 50 workflow demo scripts were also replayed through the actual demo player. Native input palettes have a separate regression in both themes.
- Registry validation, TypeScript, the unit suite and the Node 24 production build pass. Broader integration and deployed-route evidence is recorded separately in the release verification report.

These are frontend components with realistic offline demonstrations. The host remains responsible for authentication, authorization, persistence, billing enforcement, delivery, uploads and industry rules. Saving a draft does not execute a payment, send a message or sign a document. Finance displays supplied rates and assumptions; legal components track supplied records and deadlines.

The catalogue now contains 243 components: 175 Pro and 68 free. This batch adds 56 Pro components and keeps the free catalogue unchanged.

## Industry content opportunities

The suites support practical guides around fulfilment exceptions and inventory allocation; fashion buying and size planning; financial close and cash forecasting; employee onboarding and staffing coverage; and legal matter intake and document collection. The scroll set supports a separate guide to accessible editorial storytelling, expanding media and mobile fallbacks.
