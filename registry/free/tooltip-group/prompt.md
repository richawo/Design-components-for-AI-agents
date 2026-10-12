Build a tooltip group for toolbars in React + Tailwind CSS v4 + `motion/react` (icons from `lucide-react`). Its idea is timing done properly: a tooltip waits 400ms for the pointer to rest, closes the instant it leaves, and once one is open its neighbours open with no wait at all, because the one floating surface glides from trigger to trigger instead of popping in and out.

**API**
- `TooltipGroup` is a `position: relative` wrapper that owns the timing, the single floating surface and the collision boundary (its own box). Props: `delay` (400), `skipDelay` (300), `side` (`top | right | bottom | left`, default top), `arrow` (true), `shortcuts` (true), `offset` (6), `collisionPadding` (8), `defaultActive` (a Tooltip id shown once on mount), `theme` (`dark | light`), `onTimingEvent`, `className`, `style`.
- `Tooltip` wraps one trigger: `id`, `label`, `shortcut` (e.g. `["⌘", "⇧", "X"]`), one child element. It renders `<span data-tg-trigger={id} class="inline-flex">` around the child, registers `{label, shortcut, el}` with the group through context, and clones the child with `aria-describedby` (only while its tooltip is open) and `aria-keyshortcuts` (`⌘`→Meta, `⇧`→Shift, `⌥`→Alt, `⌃`→Control).
- No portal: the surface is absolutely positioned inside the group. Document lifting it to `document.body` for clipping parents.

**Timing model (one ref, never React state)**
- The group listens with delegation: `pointerover` finds `closest("[data-tg-trigger]")`, `pointerleave` on the root closes. Touch is ignored for hover.
- Cold trigger: start a `delay` timer, then open. Warm group (a tooltip is open, or one closed less than `skipDelay` ago): open instantly. Delay 0 opens instantly.
- Pointer over anything that is not a trigger (a separator, the page) closes instantly but leaves the group warm. Leaving the group closes instantly.
- Pressing a trigger closes its tooltip and keeps it shut until the pointer moves to something else. Escape closes the open one and keeps it shut the same way.
- Keyboard focus (only when the target matches `:focus-visible`) opens instantly; blurring to something that is not a trigger closes it. Clicks never open one.
- Touch: a 450ms long press opens it, the click that follows is swallowed, and it closes 1.4s after the finger lifts.
- `defaultActive` opens after `delay + 300ms` as if hovered (so it lands after its surface), and the first pointer or focus in the group closes it and leaves the group cold, so the next hover still waits.
- `onTimingEvent` reports `wait`, `cancel`, `open` (with `via`: delay, skip, focus, press or pinned, the side it landed on and whether it flipped) and `close`.

**Placement and collision**
- Measure the next content with an invisible `w-max` copy, then place: preferred side if it fits inside the group (minus `collisionPadding`), else the opposite side if that fits, else the preferred side. Gap from trigger to box is `offset + 6` with the arrow, `offset` without.
- Cross axis: centre on the trigger, then clamp inside the group. The arrow keeps pointing at the trigger's centre, clamped 10px from the box's corners.
- Re-place on group resize (ResizeObserver).

**Anatomy**
- Box: 28px tall, 8px radius, `#1c1c1f` (dark) with `inset 0 0 0 1px rgba(255,255,255,.1)`, `inset 0 1px 0 rgba(255,255,255,.06)`, `0 12px 32px -12px rgba(0,0,0,.95)`, `0 3px 8px -3px rgba(0,0,0,.7)`. Light theme keeps a dark `#18181b` box with a softer warm shadow. Label 12.5px Geist 500, `#f4f4f5`, 10px left padding.
- Keycaps: `<kbd>` 18px tall, min 18px wide, 5px radius, mono 10.5px `#a1a1aa`, `rgba(255,255,255,.07)` fill, 1px inset hairline and a 1px darker bottom inset for depth; 3px apart, 8px after the label, 5px from the box's right edge (equal to the vertical inset).
- Arrow: a 14×6 triangle with a rounded tip, filled with the box colour and stroked with the hairline on its two slanted edges only, overlapping the box by 1px so the box's own hairline disappears under it. Drawn once pointing down and rotated 0/180/−90/90° for top/bottom/left/right.

**Motion**
- Fresh open: opacity 0→1, scale 0.97→1, blur 2px→0 over 180ms `cubic-bezier(.22,1,.36,1)`, sliding 4px away from the trigger; transform origin on the trigger's side.
- Close: opacity to 0 in 70ms ease-in (reads as instant), then `visibility: hidden`.
- Between neighbours: x, y, width, height and the arrow all spring (stiffness 500, damping 40) to the new trigger; the label cross-fades 6px in the direction of travel with a 3px blur (in 200ms, out 120ms). Crossing a separator within 120ms of a close still glides.
- Every position is a motion value, so a reversal mid-glide just retargets. A cold arrival stops unfinished springs and resets the label presence so an old tooltip never flashes at a new trigger. Updating a trigger label keeps the active tooltip open; removing the active or pending trigger closes it. Cancelled touch gestures clear the pending press and click suppression.
- Reduced motion: no slide, scale, blur or glide; positions jump and opacity fades in 120ms.

**Demo (true near-black stage)**
- A 640px document card (`#0c0c0e`, 18px radius, hairline ring) is the group: mono breadcrumb "Drafts / Lisbon offsite" and "Edited 4 min ago", a Geist headline "What we decided in Lisbon" (clamp 1.5–2rem, −0.035em, leading 1.05), two 15px paragraphs at 1.65 leading in `#a1a1aa`, one phrase shown as a selection that takes the formatting the toolbar toggles.
- Bottom toolbar (`role="toolbar"`, roving tabindex with arrows, Home and End): 40px icon buttons with no gaps inside a cluster so the surface glides straight across, a 1px separator between Bold, Italic, Underline, Strikethrough, Inline code and Add link, Comment. Pressed tools get a 10% ink fill. A mono word count sits on the right from 28rem.
- Under the card, a timing readout: a 56px hairline that charges over the delay while the pointer rests, a counting "Waiting 312 ms", then "Bold opened after 400 ms", "Italic skipped the wait", "Closed instantly", with " · flipped bottom" when a collision flipped it. From 28rem the right side states the contract: "open 400 · neighbours 0 · close 0 ms".
- "Add link ⌘ K" is pinned on load. Entrance once at 30% in view: blocks rise 12px out of an 8px blur, 60ms apart.

**Accessibility**
- `role="tooltip"` with an id that the open trigger references through `aria-describedby`; hidden from assistive tech while closed. Icon buttons keep their own `aria-label`; tooltips are never the only name.
- Escape closes, keyboard focus opens instantly, the toolbar is one tab stop with arrow-key roving, and `aria-pressed` on toggles.

**Don't**
- No delay on close, no re-entry animation between neighbours, no tooltip per trigger in the DOM, no tooltips on click, no bounce, no coloured or glowing tooltips, no tooltip that hides the only label of a button.

**Robustness**
Keep the demo metadata readable: dark muted #8a8a93, light muted #62626b.


If the active or pending trigger is removed, close immediately and wait for a deliberate pointer move or keyboard focus before another trigger can open. A layout shift under a stationary pointer is not a new hover request.
