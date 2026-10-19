Build one sortable data table in React + Tailwind CSS v4 + `motion/react` (lucide-react for two icons). Not a dashboard: a single dark card holding a studio's invoices. The idea is that sorting is physical. When a header is clicked the rows don't re-render in place, they travel to their new positions, and a faint spotlight glides across to the sorted column. Monochrome with one accent, on selection only.

**Tokens** (one `PALETTE` with `dark` and `light`, written to CSS variables on the root; one `T` timeline in seconds; named springs)
- Dark: stage `#000000`, card `#0b0b0c` with an inset white/8% hairline, a white/5% top highlight and a long soft drop shadow; ink `#f4f4f5`. Selection bar `#1c1c1f`.
- Light: stage `#f4f4f5`, card `#ffffff`, ink `#111113`, selection bar `#111113` with `#fafafa` ink.
- Text steps are ink at 90 / 75 / 60 / 45 / 38%. Hairlines ink/7%.
- `accent` prop, default `#5e9eff`: checked boxes (check drawn in black or white by luminance), selected rows (accent 11%, 15% on hover), the resize guide and the selection total. Status dots use semantic tones (dark: `#4ade80`, `#fbbf24`, `#f87171`, `#71717a`), each with a 3px 16% halo. Nothing else gets colour.

**Layout**
- `@container` root, max-width 1040px, radius 16px. Head: title (Geist 17px semibold, tracking −0.02em) with the row count in mono 11px ink/38 beside it, a 13px ink/45 description, and on the right a density switch.
- The table is an ARIA grid built from CSS grid rows sharing one `grid-template-columns` variable: a 48px checkbox column, then each column at its width, the last one `minmax(width, 1fr)` so figures sit on the right edge. Columns that haven't been resized shrink proportionally towards their `minWidth` to fit the container (measured with ResizeObserver); past that the table scrolls sideways inside its own scroller.
- Header row 40px; rows 52px regular, 36px compact (the height transitions in 150ms). Cells padded 12px.
- Under 520px of container each row folds into a card: checkbox, title (the entity column) and value (the last figure column) on one line, the other columns as a 12.5px meta line indented under the title. The header is hidden and a "Sort" row of buttons replaces it.

**Cells by kind**
- entity: a 24px monogram tile (radius 7px, ink/7% with an ink/8% hairline, mono 9.5px initials) and the name at 14px medium.
- mono: 12.5px mono ink/60 (invoice numbers). date: `Intl.DateTimeFormat` short month + day, tabular. status: 6px dot + label.
- currency: right-aligned, tabular, 14px medium, the fraction ".50" at ink/38. Figures count up from zero on first view, written straight to the DOM from a motion value.

**Sorting**
- Header labels are mono 11px uppercase, tracking 0.08em, ink/45; the sorted one is full ink. An arrow (12px) sits after the label (before it on right-aligned figure columns), invisible until hover (40%), solid when sorted, and rotates 180° on spring 500/40 between directions.
- Clicks cycle: first direction (descending for figures and dates, ascending for text), the other, unsorted. Ties keep the original order.
- Rows use `layout="position"` on a spring (stiffness 340, damping 36, mass 0.9), so every row travels to its new slot at once. A full-height column spotlight (ink/3.5% with ink/5% side hairlines) slides to the sorted column on spring 500/40.

**Resizing**
- A 12px handle straddles each header's right edge. Its 1px line is 14px tall at ink/14%, grows to 24px at ink/55% on hover, and while dragging turns accent and full height. An accent guide runs down the whole table and an accent mono chip under the handle reads the width ("268px").
- During a drag the template is written straight to the grid element (no React render per move); the width commits on release. Double-click resets. Clamp to min/max (default max 560).

**Selection**
- A 16px checkbox (radius 5px, inset 1.5px ink/26% ring, ink/48% on hover) inside a 44px hit area; checked is an accent fill whose check path draws in 220ms. Select-all in the header goes mixed.
- Press a box and sweep up or down across others to select (or deselect, if the first box was on) the whole run, using pointer capture. Shift-click on a box or row extends from the last anchor.
- A floating bar rises 14px out of a 4px blur at the bottom: "5 selected", a hairline, "TOTAL" in mono and the summed amount counting to its new value, the actions, and a clear button. The body gains 68px of bottom padding while it shows, so the last row is never trapped under it.

**Sticky header**
- On: rows scroll inside `maxHeight` (440px) with the header pinned, and a soft shadow fades in under it once scrolled. Off: the table grows to fit every row.

**Entrance** (once, at 20% in view): the card rises 16px out of an 8px blur (600ms, ease `[0.22, 1, 0.36, 1]`), then the head (0.08s), the column labels (0.14s) and the rows from 0.2s, 35ms apart (capped after 12). Amounts count 100ms after their row lands; the spotlight fades in at 0.55s. Reduced motion: a 150ms fade only, no row travel, figures set instantly.

**Accessibility**
- `role="grid"` with `aria-rowcount`, `aria-colcount`, `aria-multiselectable`; rows carry `aria-selected` and `aria-rowindex`; sortable column headers carry `aria-sort`.
- Roving focus: exactly one cell is tabbable. Arrows move, Home/End go to the row's ends (with Ctrl/⌘ to the first/last row), PageUp/PageDown move ten rows. Space toggles the row, Shift + ↑/↓ extends the selection, Ctrl/⌘+A selects all, Escape clears. Enter or Space on a header sorts; Shift + ←/→ on a header resizes by 16px.
- A polite live region announces sort, selection count and resizes. The density switch is a radiogroup with arrow keys. 2px ink focus rings inset on cells, keyboard only.

**Don't**
- No zebra stripes, no vertical gridlines, no coloured header band, no pill badges for status.
- No rows that jump to their new order, no per-frame React state for counting figures or live resizing.
- No left-aligned figures or proportional digits. No horizontal page scroll at any width.

An empty `columns` array renders the title and `emptyLabel` status rather than an invalid table. Keep secondary text and numbers at least 65% ink in both themes.

**Custom numeric display**
A numeric column may supply `formatValue(value)` for its visible cells, screen-reader text and selected sum. Sorting keeps the original numbers. The formatter also receives intermediate counting values, so keep it pure and account for those values when displaying integer minor units. Omit it to retain the existing currency and number formatting.
