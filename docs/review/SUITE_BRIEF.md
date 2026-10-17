# Industry suite addendum (read after REVIEW_BRIEF.md)

You are rebuilding components from one of the industry suites (SaaS admin, legal, HR, finance, fashion, commerce). About 70 of these were added in one pass from a single template: a mono "SUITE / TOOL NAME" eyebrow, a serif or sans title, a grey subtitle, then list-left / detail-right in flat outlined wells, 9–12px grey type, native selects and inputs, and disclaimer copy. They read as one generic admin page repeated 70 times.

## The bar for vertical SaaS

Think of the best of each vertical: Linear, Ramp, Mercury, Brex, Stripe Dashboard, Shopify admin at its best, Rippling, Deel, Ironclad, Harvey, Faire, Attio. What they share, and what you must deliver:

- **The work object is the hero.** An invoice looks like an invoice, a contract like a contract with clauses, a size guide like a garment with measurements, a payment run like a batch you can watch settle, a calendar like a calendar, an org chart like a tree. Not a form describing the object.
- **One signature interaction per component** that makes the job faster or clearer: drag to allocate, scrub a timeline, match two ledgers with lines that draw between them, a meter that fills as you select, a diff that highlights, a stamp that lands on approval.
- **Purposeful density.** Real tables with tabular numerals, aligned decimals, sortable headers, sticky totals; 13–14px table text, 15–16px body, 12px mono metadata; real column widths. Dense is fine; cramped and tiny is not.
- **Precise figures that move.** Totals count, deltas show direction with colour that means something, progress fills after landing. Money is formatted with Intl and the currency's rules.
- **Decisions feel consequential.** Approve/reject/send/post have pending, success (with a receipt-like confirmation), failure with the draft kept, and undo where real products have it.
- **Suite coherence.** Your 4–5 components belong to one suite: share the same visual language within your batch (same token object shape, same header pattern, same table style, same accent default), while each still has its own signature. A customer buying the suite should feel they were designed together. Industry components are Pro.
- Dark default with a polished `theme="light"`, one `accent` prop, control-kit controls, custom dropdowns or native selects with the inset chevron per spec.
- Kill: the mono eyebrow + big title + grey subtitle header (use compact product chrome: breadcrumb, entity name, status, actions), flat outlined wells, disclaimer copy ("supplied", "illustrative", "sample data", "no records leave this preview", "this component does not…").

Before you write code for your batch, look at all your components' current posters (`public/previews/<slug>.webp`) and at 3–4 of the reference components named in REVIEW_BRIEF.md, and decide the suite's shared language. Then build each component.

## Browser probes (added by the lead)
`tests/browser/pro-50/<slug>.mjs` exists for most industry components and asserts the old UI. You may (and should) rewrite the probes for your own slugs against the new UI, in the style of `tests/browser/pro-50/hr-org-explorer.mjs`: failed-then-successful callbacks with the draft kept, keyboard paths, empty/invalid data. Make them pass with `PREVIEW_BASE=http://localhost:3100 node tests/browser/pro-50-<suite>-probe.mjs <slugs>` and report the result.
