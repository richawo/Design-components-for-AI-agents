Build one primary call-to-action button in React 19 + Tailwind CSS v4 + `motion/react`. It is the only button in the view. It leans toward the pointer as the pointer approaches, the way a magnet pulls a small object across a desk. It should feel physical and deliberate: the surface follows the cursor by a few pixels, the label and the arrow travel together at nearly the same depth, and a soft light tracks the cursor across the fill. Nothing bounces. Nothing glows.

**Layout**
- The root is an inline element: `relative inline-flex max-w-full align-middle`, intrinsic width, with no `w-full`, no `justify-center` and no `@container`. It sits wherever the consumer puts it, and `className` is applied to the root for margin or alignment.
- Three nested layers, in this order: an untransformed anchor span (`relative inline-flex max-w-full`) that is the measuring reference, then a lean span (`inline-flex max-w-full`) that carries the surface translate, then the button. The lean never moves the anchor, so the pull is measured from the resting position and cannot feed back into itself.
- The button is at least 56px tall (`min-h-14`), radius 14px, horizontal padding 28px, vertical padding 16px, intrinsic width, capped at `max-w-full`. The label and arrow sit in one row with a 10px gap (`gap-2.5`). The row is `min-w-0`, the label span is `min-w-0` with `text-balance`, and the arrow is `shrink-0`.
- Short labels stay on one line at the 56px height. A label too long for its container wraps inside the button and grows the height; it never overflows the container, at any width from 320px up.
- The arrow is an optional 16px drawn icon on a 16-unit grid: a shaft from x 2.75 to x 12.25 at y 8, and a chevron from (8.75, 4.5) to (12.25, 8) back to (8.75, 11.5), stroke 1.6, round caps and joins, `aria-hidden`.
- Nothing else in the component. No headline, no badge, no secondary button. The demo stage centres it with `px-6`; the component does not centre itself.

**Typography**
- Geist (`font-sans`), weight 500, 15px at every size, letter-spacing -0.01em, line-height 1.25 (`leading-tight`) so a wrapped label breathes. A label that fits on one line is visually identical to line-height 1.

**Colour**
- Three CSS variables are set on the root: `--mb-accent` (the fill), `--mb-ink` (the label) and `--mb-ring` (the focus ring).
- The fill defaults by surface: `#e9e9eb` on dark, `#0a0a0b` on light (ink, so the primary action reads as a primary action on a light page). The `accent` prop replaces it on either surface.
- The label ink is whichever of `#0a0a0b` or `#ffffff` has the higher WCAG contrast on the fill.
- Surface: `background: var(--mb-accent)`. Shadow on dark: `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 1px <rim>, 0 1px 2px rgba(0,0,0,0.4), 0 12px 24px -12px rgba(0,0,0,0.6)`. Shadow on light: `inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px <rim>, 0 1px 2px rgba(0,0,0,0.12), 0 10px 20px -12px rgba(0,0,0,0.28)`. The rim is `rgba(0,0,0,0.06)` on a light fill and `rgba(255,255,255,0.08)` on a dark one. The shadow is neutral. It must never tint the page with the accent.
- Spotlight: a white radial gradient of radius 90px (about 1.6 times the 56px button height), centred on the pointer (`--mb-sx`, `--mb-sy`), fading to transparent at 70%. It is sized from the button, not from the reach. Its alpha scales with the fill's WCAG relative luminance L: `alpha = clamp(0.14 + 0.4 * L, 0.14, 0.42)`. A dark fill takes about 0.14, ember (`#d4775b`, L about 0.28) about 0.25, and the default near-white about 0.42. A mid-tone never gets a hotspot. Never a dark spot: a dark spotlight reads as a grey smudge on the fill.
- Focus ring: a solid 2px outline, 4px offset, on keyboard focus only. Its colour is the fill when the fill contrasts with the page surface more than the opposite ink does, otherwise the opposite ink (`#f4f4f5` on the dark surface `#0b0b0c`, `#0a0a0b` on the light surface `#f4f4f2`).
- Demo stage only: `#0b0b0c` dark or `#f4f4f2` light, caption `#8a8a93` or `#6b6b73`.

**Motion**
- Lean: a window-level `pointermove` listener (mouse and pen only, never touch) measures the pointer from the anchor's centre and from the button's edge. Let `d` be the distance from the centre and `edge` the distance from the pointer to the nearest point of the button's body (zero inside it). `nearness = 1 - clamp(edge / radius, 0, 1)`. `pull = (1 - (1 - nearness)^2) * clamp(d / 48, 0, 1)`. The lean vector is the unit vector from the centre toward the pointer times `pull`, per axis from -1 to 1. Measuring from the edge makes the lean reach full strength at the button's edge, so it is visible while the pointer is still 40px outside.
- The two lean components feed `useSpring` on `spring.soft` (stiffness 180, damping 22). Leaving the page (a `pointerout` with no related target) sends both to 0 and the spring settles them. Interruptible: a pointer that returns mid-settle picks up from wherever the spring is.
- Depths, as CSS `translate` calc expressions on `--mb-lx`, `--mb-ly` and `--mb-strength` multiplied by a depth factor in px. The surface moves 1.0 (the whole button, including its fill and spotlight). The label sits at -0.2 inside the surface, so it nets 0.8 of the lean. The arrow sits at +0.1, so it nets 1.1. The label-to-arrow gap therefore changes by 0.3 times the lean: 2.4px at the 8px cap, and never enough to close on the label. Do not widen this differential above 0.375 (3px at 8px). A wider parallax reads as broken kerning, not depth.
- Strength is the maximum lean in px, 0 to 8, default 6. Reach (radius) defaults to 200px from the button's edge and governs the pull only.
- Hover: the spotlight fades in on `spring.ui` (stiffness 500, damping 40), and the arrow nudges 2px right on the same spring.
- Press: `scale` 0.97 on `spring.ui` on pointer down, or on Space or Enter key down (not repeat). It springs back on pointer up, leave or cancel, on key up, or on blur.
- Reduced motion: no lean (the lean springs never move), no scale, no arrow nudge, and the spotlight parks at the middle of the button instead of tracking the pointer. A press dips opacity to 0.9 instead. The hover fade stays, because it is an opacity change.
- Disabled: no lean, no hover spotlight, no press. Clear any hover or press state held when it became disabled.
- Nothing loops. Nothing runs when the pointer is absent.

**Accessibility**
- A native `button` with `type="button"`, so Enter and Space activate it with no custom key handling. A key press (not a repeat) also sets the pressed state, so keyboard users get the same press feedback.
- The arrow is `aria-hidden`. The label is the accessible name.
- Focus-visible uses the ring above. It never shows on a mouse click.
- `disabled` drops the button to 40% opacity with `cursor-not-allowed`, and stops the lean, the hover and the press.
- Touch input never leans, so the button does not track a finger across the page.

**Don't**
- A glow around the button, a gradient fill, a gradient label, a sparkle icon, a pulsing ring, or any idle motion.
- A dark spotlight on a light fill. A grey smudge reads as dirt, not light. A spotlight stronger than the fill's luminance allows, which blows out a mid-tone accent.
- A near-white fill on a light surface. Light takes ink by default.
- An accent-coloured shadow. On a dark page it becomes a white bloom under a light button.
- A pointer lean larger than `strength`, a lean that moves the anchor, or a lean that bounces. It settles on a spring and nothing overshoots.
- A label-to-arrow depth differential above 0.375 of the lean, which squashes the arrow into the label.
- A root that forces full width or centring, or a button that overflows a container. The button is inline, and the consumer places it.
- Hard-coded colours that ignore `accent` or `theme`.
- Lean driven by CSS `:hover`. The demo player dispatches pointer events, not hover states, so the lean must come from JavaScript pointer events.
- Two lean-enabled buttons in one view. The idea depends on there being one primary action.
- Filler copy. The default label is "Start building".
