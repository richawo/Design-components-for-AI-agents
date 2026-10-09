Build a ⌘K command palette in React + Tailwind CSS (v4), using `motion/react` for the cascade, the selection and the toast and `lucide-react` for icons. It should feel like a precise, quiet tool: greyscale throughout, one solid raised panel, and a single warm accent that marks the selection and the matched letters.

**Layout**
- The component is one `@container` root that the caller gives a height (the demo: `max(720px, 100dvh)` on `#0a0a0b`). It holds only real parts: the trigger, the scrim, the palette and the toast. No fake app behind it.
- **Trigger**: a 48px field centred 64px from the top (96px from a 672px container), max 640px wide: field fill, a 1px line border, an inset top highlight, a search icon, "Search or jump to…" and ⌘ K keycaps.
- **Scrim** over the root: black at 55% with a 2px backdrop blur (light theme: `#f4f4f5` at 60%). Clicking it closes.
- **Palette** opens over its own trigger: max 640px wide, 12px from the edges (24px from a 512px container), 56px from the top (88px from 672px). Solid panel, not glass; radius 16px, a 1px line border, an inset top highlight and a deep shadow (`0 24px 80px -12px` black at 90%).
  - **Search row**: 60px, an 18px search icon, a borderless input (16px, 17px from 512px so iOS never zooms) and an `esc` keycap button from 512px. A rule under it.
  - **Results**: max-height `min(400px, 100dvh − 240px)`, 8px padding. Each group has a mono label (10.5px, uppercase, 0.14em tracking); groups after the first sit under a rule. Rows are at least 44px tall, radius 10px: a 28px icon tile, the label (truncates), an optional mono hint ("OPS-412", "Project") and shortcut keycaps (from 512px).
  - **Footer**: 44px, ink at 2%, mono 11px: ↑ ↓ navigate, ↵ open, esc close on the left, a live result count on the right.
- Keycaps: 22px tall, min 22px wide, radius 5px, a 1px line border, field fill with an inset highlight, mono 11px in the muted grey.

**Colour** (one `PALETTE` object written to `--cp-*` CSS variables; `theme="dark" | "light"`)
- Dark: panel `#111113`, field `#141416`, line `#232327`, rule `#1c1c1f`, ink `#f4f4f5`, body `#c4c4ca`, muted `#a1a1aa`, faint `#8a8a93`, tile `#1b1b1e`, hover white/6%, press white/10%. Light: `#ffffff`, `#fafafa`, `#e4e4e7`, `#efeff1`, `#18181b`, `#3f3f46`, `#52525b`, `#71717a`, `#f1f1f3`.
- Rows read in the body grey, the selected row in ink on the hover tint, its icon tile inverted (ink tile, panel-coloured icon).
- One `accent` prop (default `#ff7a45`): the 3px selection marker on the row's left edge, and the highlighter-pen stroke behind matched characters (accent at 30% via `color-mix`, radius 3px, text stays ink). Nothing else is coloured. The toast is an ink pill with a check.

**Behaviour**
- Fuzzy subsequence matching: each query character must appear in order. +1 per character, +4 when it follows the previous match, +3 at a word start, minus a small penalty for gaps and long labels. `keywords` matches count but rank 3 lower and highlight nothing. Sort within groups; hide empty groups.
- ↑/↓ wrap, Home/End jump, Enter runs the active row, Esc clears the query and then closes. Hovering a row activates it; the active row scrolls into view (`block: nearest`).
- ⌘K / Ctrl+K toggles from anywhere. Opening focuses the input (the demo's first open doesn't steal focus unless `autoFocus`). Closing returns focus to the trigger.
- Running an item flashes its row, closes the palette and shows "Ran “Inbox” · ⌘K to reopen" for 2.2s.
- Empty state: a dashed 44px circle with a search icon, "Nothing matches “xyz”" and two suggestion buttons (`suggestions` prop) that fill the query.

**Motion** (one `MOTION` object; ease-out `[0.22, 1, 0.36, 1]`, ease-in `[0.4, 0, 1, 1]`, `spring.ui` 500/40)
- First view (20% visible): the trigger rises 10px out of an 8px blur over 420ms, then the palette opens 160ms later.
- **Every open** is a cascade, not one block: the panel comes from y −10px, scale 0.98 and an 8px blur (320ms, origin top); the search row follows at 50ms; then each group label and row, in reading order, from a 6px rise and blur, 25ms apart from 100ms, capped at 10 steps so long lists never drag (360ms each); the footer lands last. Everything is down by about 800ms.
- Rows that appear later, while typing, settle from a 3px blur in 180ms with no stagger.
- Exit: y −6px, scale 0.985, a 4px blur, 160ms ease-in. The scrim fades.
- One highlight and the accent marker glide between rows together on a shared `layoutId` (`spring.ui`); rows never light up individually.
- Choosing flashes the row (scale 0.985, press tint) for 130ms before the palette leaves. The toast rises 12px out of a blur.
- Every timer goes through one helper that clears on re-schedule and unmount.
- Reduced motion: 150ms opacity fades only, no marker travel, no press delay.

**Accessibility**
- The palette is `role="dialog"` with a label. The input is `role="combobox"` with `aria-controls`, `aria-expanded`, `aria-autocomplete="list"` and `aria-activedescendant`, so focus never leaves the input. Ids come from `useId`.
- The results are `role="listbox"`, each group `role="group"` labelled by its heading, each row `role="option"` with `aria-selected`.
- The result count and the empty state are polite live regions. The trigger has `aria-keyshortcuts`. Focus rings: 2px ink, offset 2px, keyboard only.

**Don't**
- No fake app, sidebar or skeleton behind the palette. No glass panel (the scrim may blur), no gradient border, no sparkle "Ask AI" row.
- No coloured icon tiles or a colour per group. Don't highlight matches with bold or colour alone; the highlighter is the idea.
- Don't drop the palette in as one block, and don't move focus into the list.
