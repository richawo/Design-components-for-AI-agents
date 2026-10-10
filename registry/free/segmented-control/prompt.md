Build a segmented control in React 19 + Tailwind CSS v4 + `motion/react` that feels like one physical track with one raised pill: the selection travels between segments on a spring, nothing ever hard-cuts, and the same control works at full width or inside a narrow column. Monochrome, dark first, no accent colour: the selection is ink on paper.

**Layout**
- Root: `@container`, full width. Inside it, a radiogroup track with 3px of inner padding on every side.
- Track, equal width: fills the root. Every segment takes an equal share (`flex: 1 1 0`) but never less than its label (`min-width: max-content`), so a label never truncates. While the shares fit the labels, the segments are exactly equal; once they cannot, the segments keep their label widths and the track scrolls.
- Track, content width: the track is `fit-content` and never wider than its container. Segments size to their labels and the group sits at the start of the track.
- Scroller: in both widths, the segments sit inside a horizontal scroller within the track's padding. Hide its scrollbar (`scrollbar-width: none`, no webkit bar). The scroller is at least the track's width and grows to the labels' total width when they need the room.
- Edge fades: a 28px fade at each edge, applied as a `mask-image` on the scroller (never as an overlay), so the track's fill, hairline and rounded corners stay untouched. The fade is `linear-gradient(to right, transparent 0, #000 var(--fade-start), #000 calc(100% - var(--fade-end)), transparent 100%)`, where each variable is 28px while more segments lie past that edge and 0px otherwise. Register both variables with `@property` as `<length>` (not inherited, initial 0px) so the mask transitions between states over 200ms ease-out.
- Scroll into view: when the selection moves, the track scrolls so the selected segment sits at least 32px inside any edge that has a fade (the fade plus 4px of air), so the fade never covers the selected segment or its focus ring. The scroll is smooth, and instant under reduced motion. Nothing scrolls the page.
- The track keeps the selection in view while its own box resizes, so a column that narrows never leaves the selected segment hidden.
- Segment height: 36px (md) or 30px (sm). Track radius: 11px (md) or 10px (sm). Pill and segment radius is the track radius minus 3px, so the padding stays even.
- Segment horizontal padding: 10px, rising to 14px once the root container is 22rem or wider.
- Icon and label gap: 6px (md) or 5px (sm). Icon 15px (md) or 13px (sm), 1.75 stroke, sitting left of the label. Under a 22rem container, equal width folds the icons away by easing their width, margin and opacity to zero over 200ms, so a narrowing column keeps its labels in place. Content width keeps its icons.
- Zero segments: render nothing. All segments disabled: render the track, every segment locked, with no pill.

**Typography**
- Labels: Geist 500, tracking -0.01em, 14px (md) or 13px (sm), no wrapping and no truncation.
- Counts: Geist 400, tabular figures, 13px (md) or 12px (sm), in the muted ink. Formatted with `Intl.NumberFormat("en-US")` so 2314 reads 2,314.
- Nothing is uppercase or mono inside the control. The demo's card header and its column toggle are the only mono text.

**Colour (dark first, no accent)**
- Tokens are CSS variables set on the root from a `theme` prop. Dark: track `#19191c`, track ring 1px inset at 7% white, pill `#2c2c31`, ink `#f4f4f5`, muted `#8a8a93`, focus ring ink at 70%. Light: track `#f1f1f3`, track ring 1px inset at 7% ink, pill `#ffffff`, ink `#18181b`, muted `#64646e`, focus ring ink at 70%.
- The track is opaque, so the edge fades can mask into the track colour without a seam.
- Pill shadow: a 1px inset hairline at 8% white (dark) or 5% ink (light), a 1px inset top highlight, a 1px 2px drop at 50% black and a soft 6px 14px drop at 70% black (dark). Light uses a 10% drop and a 28% soft drop instead.
- Selected label: ink. Unselected label: muted, moving to ink on hover (enabled segments only). Hover changes the text colour only, with no surface, so the hovered segment never reads as a second pill.
- Disabled segment: 40% opacity, `cursor-not-allowed`, no hover colour. The demo's Customize panel locks Month so this state and the arrow-key skip can be inspected.

**Motion**
- The pill is one element, drawn beneath every label in the track's content and measured from the selected segment (its offset and width, in the track's own coordinates). It moves on `spring.ui`: stiffness 500, damping 40, no bounce. A reversed or repeated pick redirects mid-flight because the spring starts from the current position. Because labels always paint above the pill, a pill crossing a neighbour never blanks that neighbour's label.
- The pill is not a per-segment shared layout element. Do not use `layoutId` for it; measure it instead, and re-measure on every resize of the track or its content. Segments shrink continuously as the box narrows, so the pill's spring follows them rather than jumping to a new layout.
- Hover: an unselected enabled segment's label moves to full ink over 150ms ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`), with no surface change.
- Press: the label of an enabled segment scales to 0.97 over 90ms on the same curve and springs back on release, so the segment reads as a key. The segment itself is not scaled, so the pill never changes stacking while it travels.
- Edge fades: the mask variables transition over 200ms ease-out when a scroll edge appears or disappears.
- Demo entrance: the card rises 12px out of an 8px blur over 500ms ease-out. The header follows at 60ms, the control at 160ms and the column toggle at 260ms. The count in the header tweens from 0 over 500ms when the card lands, then tallies on each change.
- Demo period word: when the selection changes, the period word in the header cross-fades (`AnimatePresence mode="popLayout"`) with a 5px vertical offset and a 3px blur over 180ms ease-out. Opacity only under reduced motion.
- Demo column: the column narrows from 100% to 216px over 420ms on `cubic-bezier(0.65, 0, 0.35, 1)` when the toggle is pressed. The control keeps its width mode throughout, so the segments shrink in step with the column and the overflow appears only once the labels can no longer fit.
- Reduced motion: the pill jumps, scrolling jumps, the column narrows at once and the entrance is an opacity fade of 150ms. Colour transitions stay.

**Responsive**
- Equal width works from 320px upward: three segments fit at 390px, and at narrower widths the track scrolls rather than truncating a label.
- The track scrolls inside its own box. The page never scrolls sideways.
- The demo card is 440px at most and fills narrower screens with 24px of stage padding (40px from the sm breakpoint). The demo column narrows to 216px, so the overflow is on show at every width.

**Accessibility**
- The track is `role="radiogroup"` with an `aria-label`. Every segment is a native `button` with `role="radio"` and `aria-checked`.
- Roving focus: only the selected segment is in the tab order (`tabIndex` 0). The others are `-1`.
- Arrow Right and Arrow Down select and focus the next enabled segment. Arrow Left and Arrow Up select and focus the previous one. Both wrap, like native radios. Home and End select the first and last enabled segments. Disabled segments are skipped.
- Space and Enter activate the focused segment through the native button.
- Focus-visible: a 2px outline in ink at 70%, drawn 3px inside the segment (`outline-offset: -3px`) so it stays visible over the pill and inside the scrolling track. It appears instantly and only for keyboard focus.
- Icons are `aria-hidden`. Counts are plain text, so screen readers hear "Week" and then the number.
- Picking the already selected segment fires nothing.
- The demo's column toggle is a button with `aria-pressed`, with a 2px focus outline offset 2px from its text.

**Demo (the default export)**
- A stage that follows the theme: `#09090b` (dark) or `#f4f4f5` (light), filling the preview frame with `min-h-dvh`, so the card sits centred vertically. A centred 440px card with an 18px radius, a 1px inset ring at 8% white (dark) or 8% ink (light), and a deep soft shadow.
- Card header, mono 11px uppercase, tracking 0.12em, muted: "Dictation volume" on the left and "Month · 64" on the right at the start, with the period word cross-fading and the count tweening to the selected period.
- Main control: Week, Month and Year with icons and counts, equal width, the default selection Month. One control only: there is no second instance. Customize can lock Month to show the disabled state.
- A hairline, then a mono text button, "Narrow column", aligned left. Pressing it narrows the control's column to 216px. The three periods overflow behind the edge fades and the track scrolls. Pressing it again is not needed for the demo.
- The cursor clicks Week (the pill travels left from Month), clicks Year (the pill travels right over Month), clicks Week again (the pill travels back left over Month), presses "Narrow column", clicks Week in the narrow track to focus it, then presses Arrow Right twice: Month, then Year. The track scrolls to bring Year into view, clear of the end fade.

**Don't**
- No accent colour, glow, gradient track or gradient text. No bounce past the spring, no pulsing selection.
- No sparkle or AI icons, no emoji, no pill badges on the counts. Counts are quiet text, not chips.
- No separate "selected" text or checkmark. The pill is the status.
- No hard cut between options, and no switch of width mode while the column animates: the pill travels on the spring, and labels never blank out under it. Reduced motion removes only the travel, so the pill appears on the new segment while colours still ease.
- No pill that paints over a label. No `layoutId` for the pill, and no press scale on the segment that would stack the pill inside a transformed box.
- No surface hover on segments that could read as a second pill.
- No scrollbar in the scrolling track, and no fade on a track that is not overflowing.
- No fade drawn as an overlay that breaks the track's corners or hairline. No fade that covers the selected segment or its focus ring.
- No hover-only affordances: every segment is reachable and selectable by keyboard and touch.
