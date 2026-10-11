# Pro expansion: 50-component implementation plan

Requested on 11 October 2026. All entries below are new Pro components. The target is eight additions in each of e-commerce, fashion, finance, HR and legal tech, plus ten shared SaaS components. Each suite includes a dashboard and substantial working workflows. This plan records intended scope, not completed delivery.

Every entry requires a self-contained typed implementation, design prompts, both themes, functional host callbacks, documented data contracts, a recorded interaction, visual review, responsive and accessibility audits, empty-data and multiple-instance checks, and meaningful behaviour regressions. Components are committed and pushed individually after verification.

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
