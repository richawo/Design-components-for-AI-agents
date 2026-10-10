Build a segmented control in React 19 + Tailwind CSS v4 + `motion/react` that feels like one physical track with one raised pill: the selection travels between segments on a spring, nothing ever hard-cuts, and the same component works at full width or inside a narrow column. Monochrome, dark first, no accent colour: the selection is ink on paper.

**Layout**
- Root: `@container`, full width. Inside it, a radiogroup track with 3px of inner padding on every side.
- Track, equal width: a flex row that fills the root. Every segment takes an equal share (`flex: 1 1 0`, `min-width: 0`). A label that does not fit truncates with an ellipsis.
- Track, content width: the track is `fit-content` and never wider than its container. Segments size to their labels, so the track hugs its content.
- Overflow (content width only): when the segments are wider than the track, the track scrolls sideways. Hide the scrollbar (`scrollbar-width: none`, no webkit bar). Show a 28px fade at each edge only while more segments lie past that edge.
- Scroll into view: when the selection moves past a visible edge, scroll the track so the selected segment sits 6px inside that edge, with a smooth scroll (instant under reduced motion). Nothing scrolls the page.
- Segment height: 36px (md) or 30px (sm). Track radius: 11px (md) or 10px (sm). Pill radius is the track radius minus 3px, so the padding stays even.
- Segment horizontal padding: 10px, rising to 14px once the root container is 22rem or wider.
- Icon and label gap: 6px (md) or 5px (sm). Icon 15px (md) or 13px (sm), 1.75 stroke, sitting left of the label.

**Typography**
- Labels: Geist 500, tracking -0.01em, 14px (md) or 13px (sm), no wrapping.
- Counts: Geist 400, tabular figures, 13px (md) or 12px (sm), in the muted ink. Formatted with `Intl.NumberFormat("en-US")` so 2314 reads 2,314.
- Nothing is uppercase or mono inside the control. The demo's card header is the only mono text.

**Colour (dark first, no accent)**
- Tokens are CSS variables set on the root from a `theme` prop. Dark: track `#19191c`, track ring 1px inset at 7% white, pill `#2c2c31`, ink `#f4f4f5`, muted `#8a8a93`. Light: track `#f1f1f3`, track ring 1px inset at 7% ink, pill `#ffffff`, ink `#18181b`, muted `#64646e`.
- The track is opaque, so the edge fades can gradient from the track colour into transparent without a seam.
- Pill shadow: a 1px inset hairline at 8% white (dark) or 5% ink (light), a 1px inset top highlight, a 1px 2px drop at 50% black and a soft 6px 14px drop at 70% black (dark). Light uses a 10% drop and a 28% soft drop instead.
- Selected label: ink. Unselected label: muted, moving to ink on hover (enabled segments only).
- Disabled segment: 40% opacity, `cursor-not-allowed`, no hover response.

**Motion**
- The pill is one shared layout element (`layoutId`, unique per instance from `useId`) that moves between segments on `spring.ui`: stiffness 500, damping 40, no bounce. A reversed or repeated pick redirects mid-flight because the spring starts from the current position.
- Label and icon colour cross-fade over 150ms ease-out (`cubic-bezier(0.22, 1, 0.36, 1)` is the curve).
- Press: an enabled segment scales to 0.97 over 150ms and springs back on release, so the segment reads as a key.
- Edge fades: opacity 0 to 1 over 200ms ease-out when a scroll edge appears.
- Demo entrance: the card rises 12px out of an 8px blur over 500ms ease-out. The header follows at 60ms, the control at 160ms, the narrow column at 260ms. The count in the header tweens from 0 over 500ms when the card lands, then tallies on each change.
- Reduced motion: the pill jumps, scrolling jumps, the entrance is an opacity fade of 150ms. Colour transitions stay.

**Responsive**
- Equal width works from 320px upward: three segments fit, and longer labels truncate instead of breaking the row.
- Content width scrolls inside its own box. The page never scrolls sideways.
- The demo card is 440px at most and fills narrower screens with 24px of stage padding (40px from the sm breakpoint). The narrow column is 248px at most, so the overflow mode is on show at every width.

**Accessibility**
- The track is `role="radiogroup"` with an `aria-label`. Every segment is a native `button` with `role="radio"` and `aria-checked`.
- Roving focus: only the selected segment is in the tab order (`tabIndex` 0). The others are `-1`.
- Arrow Right and Arrow Down select and focus the next enabled segment. Arrow Left and Arrow Up select and focus the previous one. Both wrap, like native radios. Home and End select the first and last enabled segments. Disabled segments are skipped.
- Space and Enter activate the focused segment through the native button.
- Focus-visible: a 2px outline in ink, drawn 3px inside the segment (`outline-offset: -3px`) so it stays visible over the pill and inside the scrolling track. It appears instantly and only for keyboard focus.
- Icons are `aria-hidden`. Counts are plain text, so screen readers hear "Week" and then the number.
- Picking the already selected segment fires nothing.

**Demo (the default export)**
- A stage that follows the theme: `#09090b` (dark) or `#f4f4f5` (light). A centred 440px card with an 18px radius, a 1px inset ring at 8% white (dark) or 8% ink (light), and a deep soft shadow.
- Card header, mono 11px uppercase, tracking 0.12em, muted: "Dictation volume" on the left and "Period · 741" on the right, with the count tweening.
- Main control: Week, Month and Year with icons, equal width, the default selection Month.
- Divider, then a mono caption "Narrow column, 248 px" and a 248px column holding the six periods at content width, starting on Day, so it scrolls.
- The cursor clicks Week (the pill travels left), clicks Year (the pill travels right), clicks Week in the narrow column, then presses Arrow Right three times so the selection moves to Year and the track scrolls to show it.

**Don't**
- No accent colour, glow, gradient track or gradient text. No bounce past the spring, no pulsing selection.
- No sparkle or AI icons, no emoji, no pill badges on the counts. Counts are quiet text, not chips.
- No separate "selected" text or checkmark. The pill is the status.
- No hard cut between options: the pill travels on the spring. Reduced motion removes only the travel, so the pill appears on the new segment while colours still ease.
- No scrollbar in the overflow track, and no fade on a track that is not overflowing.
- No hover-only affordances: every segment is reachable and selectable by keyboard and touch.
