# SaaS admin suite shared language (from q27, which rebuilt saas-customer-health, saas-usage-policy, saas-report-scheduler, saas-support-triage)

Copy tokens and helpers verbatim from those four files (registry/pro/saas-*/).

- Tokens: one `PALETTE = { dark, light }` object, identical values across the suite. Keys: stage, surface, panel, raised, line, lineStrong, ink, muted, faint, good, warn, bad, sheen, shadow. `cssVars()` writes `--<prefix>-<kebab-key>` plus `--<prefix>-accent` and `--<prefix>-accent-ink` (black/white computed). Pick your own 2-letter prefix per component. Dark: surface #0f0f11, panel #141417, raised #1b1b1f, ink #f4f4f5, muted #a6a6af, faint #8a8a94. Light semantics #166534 / #92400e / #b91c1c (AA).
- Accent: optional `accent` defaults to the theme's ink (monochrome suite). Colour control: default #f4f4f5, options ink, #7aa2ff, #ff8a4c; in light theme the demo maps the ink default to undefined. Primary buttons use `bg-(--x-accent)` so site accent injection recolours text correctly.
- Chrome: 56px `AppBar` with a 24px ink square holding the workspace initial, a 14px breadcrumb `Kestrel / … / Page` (page semibold), mono 12px meta or status chip on the right. No eyebrow, no headline. Fictional brand: **Kestrel**, an analytics SaaS. Shared cast: Noor Ali, Alex Morgan, Priya Raman, Sam Okafor; customers Aster Group, Northline Studio, Harbour Works, Corvid Security, etc.
- Card: `@container`, rounded-2xl, hairline ring + inset-light shadow, on a #08080a stage. Inner panels rounded-xl, border-line, bg-panel, shadow-(--x-sheen).
- Type: body 14–14.5px, meta 12–12.5px, mono 11.5–12px, tabular numerals.
- Bottom action bar (bg panel): aria-live summary/failure/success line that crossfades, ghost Discard, accent primary that keeps its width and swaps to a spinner while pending.
- Motion: `MOTION` tokens, `enter(play, delay, reduce)` (12px rise from 8px blur), `swap(reduce)` (6px/3px-blur crossfade), `useCountUp`, `SPRING_UI` (500/40) for layoutId pills and rings.
- Controls: control-kit range/stepper/check/switch; native selects get the inset chevron.
