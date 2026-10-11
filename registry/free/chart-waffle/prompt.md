Build a ten-by-ten waffle (unit) chart in React + Tailwind CSS v4 (container queries) and `motion/react`. It's monochrome with one accent, dark by default with a `theme` prop. Every cell is one ticket in a hundred, and every cell has an identity: when the period changes, the cells that change hands fly across the grid to their new group, so you watch the share move instead of reading two numbers.

**Card**
- `@container` root. Tokens per theme in one object, written to `--cw-*` variables. Dark: surface `#0b0b0c`, ink `#f5f5f4`. Light: surface `#ffffff`, ink `#0b0b0c`.
- An ink/8% border, 22px radius, an inset top highlight and a deep soft shadow.

**Header**
- The title "Who closed the ticket" (15px medium, tracking −0.01em) with a mono 11px subtitle "Per 100 support tickets" at semantic muted ink.
- Under it, the period caption ("Jul–Sep 2026 · 52,604 tickets", 13px semantic muted ink). It cross-fades on change (6px slide, 3px blur, 240ms in, 140ms out).
- Period tabs (Q4 ’25 / Q1 / Q2 / Q3) with an ink pill that slides on a `layoutId` spring (500/40). They go full width in narrow containers.

**Grid**
- 100 absolutely positioned cells in a square box (max 360px). Each cell is 10% × 10% and moves with `x`/`y` transforms in units of its own size (`x: col × 100%`), so nothing triggers layout.
- The gap is padding inside each cell (`gap` prop, default 4px), and the radius is 3px (or round, with `shape="round"`).
- Fill is column by column by default, so groups read as vertical bands; `fill="rows"` fills row by row.
- Colour: the first group takes the accent (`#ff7a45`). The others step down the ink at 62%, 34%, 17% and 10% via `color-mix`.

**Reassignment** (the idea)
- Counts are rounded to exactly 100 by largest remainder.
- On a change, each group keeps as many of its own cells as it still needs (those nearest the start). The surplus, ordered by slot, flies to the groups that grew, nearest first.
- Then every group takes consecutive slots in its previous order, so cells slide rather than shuffle.

**Headline and legend**
- The first group's count is the headline: Geist 600 at `clamp(3.25rem, 2.2rem + 4cqi, 5.25rem)`, tracking −0.055em, leading 0.9, in the accent. Beside it: "of every 100 tickets: resolved by the agent" (14px ink/60, max 16ch).
- Legend rows are buttons with a swatch, the label (13.5px), a note (12px semantic muted ink), a mono delta against the previous period (green or rose for the lead group, grey otherwise) and the count (15px tabular).
- A mono footnote reads: "Change vs Q2, in tickets per 100".

**Motion** (ease `[0.22, 1, 0.36, 1]`)
- Entrance, once at 30% in view. The card lands (16px rise, 0.6s). The title rises out of an 8px blur at 0.06s and the tabs at 0.12s. Cells pop from scale 0.4 in fill order from 0.2s, 6ms apart. The headline counts up at 0.3s. Legend rows land from 0.38s at 50ms steps, and each count rolls up from zero out of a blur.
- Switch: cells travel on a spring (320/30) staggered 4ms per slot. A cell that changes group dips to scale 0.55 and back over 0.55s, and its colour cross-fades 120ms after it sets off. Counts tween over 0.6s with a 3px blur that clears.
- Hovering a cell or a legend row dims the other groups to 20%. A mono readout under the grid says "Ticket 37 of 100 · Handled by a person".
- Reduced motion: cells jump to their slots, colours and counts are final, and only 150ms fades remain.

**Responsive**
- Grid left and legend right from `@3xl`; stacked and centred below. Deltas stay beside the counts at every width.

**Accessibility**
- The grid is `role="img"` with every group's count in its label.
- Tabs use `role="group"`/`"tab"` with `aria-pressed`. Legend rows are buttons with spoken labels and they highlight on focus. The hover readout is `aria-live="polite"`. Counting figures carry an `sr-only` final value.

**Don't**
- Use a chart library or a canvas.
- Recolour cells in place on a change. The point is that they move.
- Shuffle cells randomly or animate all 100 at once with no stagger.
- Use a rainbow of group colours, icons inside cells, a pie chart beside it or a percentage on every cell.

**Data and legibility**
- Expose `emptyMessage` for empty categories, empty periods and periods with no positive finite values. Keep the period selector available for an all-zero period. Do not fabricate cells or percentages for missing data.
- Clamp negative and nonfinite counts to zero, normalize positive values before summing to avoid numeric overflow, then allocate exactly 100 cells by largest remainder. Recreate the cell set when data returns and recycle cells from removed categories.
- Use solid muted text (#98989f dark, #62626b light). Keep legend text readable while cells dim. Light positive deltas use #047857. The headline mixes accent 65% with theme ink.
- Period controls are native buttons at least 44px high with `aria-pressed` inside a labelled group.
