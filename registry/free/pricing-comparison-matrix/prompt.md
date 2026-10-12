Build a full plan-comparison table in React + Tailwind CSS v4 with `motion/react`, for a fictional feature-flag product ("Hatch"). It's the page people open to check every line of the contract: precise, scannable and calm. Dark and monochrome: the recommended plan is marked by light (a lifted column) and one accent edge, never a tinted wash.

**Tokens** (one `PALETTE` object with `dark` and `light`, written to CSS variables on the root; one `T` timeline object in seconds)
- Dark: page `#08080a`, ink `#f4f4f5`, text on ink `#08080a`, recommended band `#111114`, tooltip `#1c1c20` with `#e4e4e7` text. Hairlines are ink at 6–12%.
- Light: page `#ffffff`, ink `#111113`, band `#f5f5f6`, tooltip `#111113`.
- `accent` prop, default `#2dd4bf`, in two places only: a 2px edge across the top of the recommended column and the dot beside "RECOMMENDED" (and on the phone tab). Checks, values, CTAs and focus rings are ink.

**Header**
- Mono eyebrow ("COMPARE PLANS", ink/50), a display semibold headline (`clamp(2.1rem, 1.3rem + 3.2cqi, 3.75rem)`, tracking −0.04em, max 18ch) and one honest sentence in ink/60.

**Desktop table** (`@3xl` container and up; `@container` on the root)
- A real `<table>`: feature names, then 4 plan columns (Hobby, Team, Business, Enterprise).
- Sticky `thead`: plan name (19px semibold), price (display, up to 36px, tabular), unit (12px ink/50), a one-line blurb from `@5xl`, and a CTA pill. The recommended CTA is solid ink; the others are ink at 4% with a 1px ink/14% inset ring. The top-left cell holds "20 FEATURES · 5 GROUPS" and an underlined "Expand all / Collapse all".
- The recommended column is a continuous lifted band from header to foot: `band` fill, ink/12% hairlines left and right, a rounded top and bottom, the accent edge on top.
- Groups (Flags & rollouts, Experimentation, Collaboration, Security & compliance, Support) each open from a row-spanning button with a chevron and a count; `aria-expanded`.
- Cells: a drawn check (ink in the recommended column, ink/75 elsewhere), a short drawn dash (ink/30) for "not included", or a value (ink medium in the recommended column, ink/70 elsewhere). Hairlines ink/6%. Features with a hint get a dotted underline and a tooltip on hover, focus or tap.

**Entrance** (≈900ms on first view)
- Copy rises 10px out of an 8px blur: eyebrow 0s, headline 0.05s, body 0.1s.
- Plan headers left to right from 0.16s, 60ms apart; inside each: label and name, then the price row (+60ms) whose number counts up from 0 over 600ms in a motion value with a velocity blur ("Custom" just rises), then the CTA (+120ms). The accent edge draws across the band at 0.5s.
- Rows: each group body has its own in-view trigger. Its slot on the first-view timeline is 0.42s + 120ms per group; if that moment has passed (it was scrolled to later), it starts at once. Rows rise 6px from a 6px blur (400ms), 30ms apart; each check draws its path (320ms) and each dash draws left to right, 80ms after the row, 30ms per column.
- Expanding a group replays the same row stagger; collapsing fades rows out in 120ms.
- Reduced motion: one 150ms fade for everything, prices set instantly, nothing moves or blurs.

**Mobile** (below `@3xl`)
- A sticky segmented plan switcher (`role="tablist"`, ink thumb on a `layoutId` spring 500/40, the recommended plan marked with an accent dot), then the selected plan's name, price and CTA. The price tweens to each newly selected plan.
- Every group lists feature name against the selected plan's value. Switching plans swaps the values with a 4px rise and a 3px blur, and the swapped-in checks draw again. No horizontal scroll.

**Footnote**
- One line of fine print (13px, ink/50) that rises in when it reaches the screen.

**Accessibility**
- Proper `th` scopes, a caption, group buttons with `aria-expanded`/`aria-controls`, tooltips reachable by keyboard and closed by Escape. Mobile tabs use roving tabindex with arrow keys. Checks and dashes carry sr-only "Included" / "Not included"; counting prices keep the real price in sr-only text. 2px ink focus rings.

**Don't**
- No teal or slate tints, coloured checks, or a washed recommended column: light and one accent edge only.
- No cramped 6-column grids on phones, "contact us" asterisks or horizontal page scroll.
- No per-frame React state for counting prices.

**Press feel**
- Buttons and links press to 0.97 (0.99 for full-width group rows) in 150ms; hover is a single step; arrows nudge 2px; focus rings appear instantly.

Secondary text uses at least 65% ink opacity on these surfaces; quiet typography must remain readable in both themes.
