Build a ⌘K command palette in React + Tailwind CSS (v4), using `motion/react` for the open/close and the selection marker and `lucide-react` for icons. It should feel like a precise, quiet tool: monochrome ink on white, with one warm highlighter-yellow for matches.

**Layout**
- A 720px-tall section (`#f5f5f3`) holds a quiet demo app behind the palette: a 240px sidebar (`#efefec`, from `md` up) with a workspace mark and five nav rows, a 56px top bar with the page title and the trigger button, and six issue rows (mono key, title, state, initials avatar).
- The trigger is a 40px white field, 288px wide from `sm`: search icon, "Search or jump to…" and ⌘ K keycaps. Below `sm` it collapses to the icon plus the keycaps.
- An ink scrim at 18% covers the app while the palette is open. Clicking it closes.
- The palette is max 640px wide, 12px from the edges on phones (24px from `sm`), 76px from the top (112px from `sm`). White, radius 16px, a 1px ring at 8% ink and a deep, soft shadow (`0 24px 64px -12px` at 28% ink).
  - **Search row**: 60px tall, an 18px search icon, a borderless 17px input (16px on phones so iOS doesn't zoom) and an `esc` keycap button from `sm`. 1px rule under it.
  - **Results**: max-height min(400px, 100dvh − 240px), 8px padding. Each group has a mono label (10.5px, uppercase, 0.14em tracking, 45% ink), and groups after the first sit under a 6% hairline. Rows are at least 44px tall with radius 10px: a 28px icon tile, the label (truncates), an optional mono hint (an issue key or "Project") and shortcut keycaps (from `sm`).
  - **Footer**: 44px, `#fafaf9`, mono 11px: ↑ ↓ navigate, ↵ open, esc close (from `sm`) on the left, a live result count on the right.
- Keycaps: 22px tall, min 22px wide, radius 5px, a 1px border at 12% ink, white with a 1px bottom shadow, mono 11px.

**Typography**
- Labels 14.5px sans (Geist). The search input is 17px with −0.01em tracking. Mono (Geist Mono) for group labels, hints, keycaps and the footer. Display (Geist at tight tracking) only for the app title and workspace name in the background.

**Colour**
- Ink `#18181b`: text at 80% (100% when selected), and metadata at 45–55%. Surfaces are white, `#f5f5f3`, `#efefec` and `#fafaf9`. The selected row is `#f1f0ec` with a 3px ink marker on its left edge, and its icon tile inverts to ink with a white icon.
- Highlighter `#ffe680` behind matched characters, radius 3px. `#ffd84d` for the suggestion underlines in the empty state and the toast dot. Nothing else is coloured.

**Behaviour**
- Fuzzy subsequence matching: each query character must appear in order. Score +1 per character, +4 when it follows the previous match directly, +3 at a word start, minus a small penalty for gaps and long labels. A match on `keywords` (e.g. "dark mode" for the theme switch) counts but ranks 3 points lower and highlights nothing. Sort within each group by score, and hide empty groups.
- ↑/↓ wrap around, Home and End jump, Enter runs the active item, and Esc clears the query first and then closes. Moving the mouse over a row makes it active. The active row scrolls into view (`block: nearest`).
- ⌘K / Ctrl+K toggles from anywhere. Opening focuses the input. Closing returns focus to the trigger. The demo opens by default but doesn't steal focus on page load (`autoFocus` prop).
- Running an item closes the palette and shows a dark pill toast at the bottom: a yellow dot, "Ran “Inbox”" and a mono "⌘K to reopen", for 2.2s.
- Empty state: a dashed 44px circle with a search icon, "Nothing matches “xyz”" and two suggestion buttons ("invite", "theme") that fill the query.

**Motion**
- The palette enters from y −10px and scale 0.98 over 220ms with ease [0.2, 0.8, 0.2, 1], and exits to y −6px. The scrim fades over 200ms.
- The selection marker slides between rows with a shared `layoutId` over 180ms. Row backgrounds change in 100ms.
- Reduced motion: opacity only, no movement, and no marker travel.

**Accessibility**
- The palette is `role="dialog"` with a label. The input is `role="combobox"` with `aria-controls`, `aria-expanded`, `aria-autocomplete="list"` and `aria-activedescendant`, so focus never leaves the input.
- The results container is `role="listbox"`, each group is `role="group"` labelled by its heading, and each row is `role="option"` with `aria-selected`.
- The result count and the empty state are polite live regions. The trigger has `aria-keyshortcuts`.

**Don't**
- No glassy blurred panel, no gradient border, and no sparkle "Ask AI" row.
- Don't highlight matches with bold or colour alone; the highlighter is the idea.
- Don't move focus into the list. Don't let the background page scroll while you arrow through.
