Build a theme toggle in React 19 + Tailwind CSS v4 + motion/react: a 36px sun/moon icon button and a Light / System / Dark segmented switch that share one mode, where choosing a new theme wipes it across the page in a circle that grows from the control you pressed. The idea: switching theme should feel like turning on a lamp in the corner of a room, not flipping a breaker.

**Layout**
- Icon variant: a 36×36 button (32 at `size="sm"`), radius 10px, holding an 18px glyph box. Sun: a r4 circle and eight 2.1-unit rays at 45° steps on a 24 grid, stroke 1.8, round caps. Moon: one crescent path `M19.6 14.4A8 8 0 1 1 9.6 4.4a6.4 6.4 0 0 0 10 10Z`, same stroke.
- Segmented variant: a 3px-padded well, radius 11px, three 32px-tall segments (28 at sm) with a 16px glyph, a 6px gap and the label at 13px weight 500, 12px horizontal padding. `labels={false}` makes them square icon-only segments.
- Demo stage only: a 56px header with the wordmark left and the icon button right (with a mono "System · dark" readout from the `@sm` container size), then a reading card and an "Appearance" row with the segmented switch, which stacks under `@sm`.

**Typography**
- Segment labels Geist 13px / 500. Readouts mono 11px uppercase, tracking 0.08em. Stage headline display 22px / 600 / −0.03em / 1.15; body 15px / 1.6, measure 52ch.

**Colour**
- Monochrome. Dark: ink #ededef, secondary #a0a0a8, hover wash rgba(255,255,255,0.06), well rgba(255,255,255,0.04), hairline rgba(255,255,255,0.09), selected pill rgba(255,255,255,0.1) with an inset top highlight. Light: ink #111113, secondary #6b6b73, wash rgba(0,0,0,0.05), well rgba(0,0,0,0.035), pill #ffffff with a 1px shadow ring.
- Stage: #08080a / card #0f0f11 in dark, #f6f6f4 / #ffffff in light. No accent colour; the theme is the content.

**Motion**
- Glyphs cross-rotate in one box over 450ms on cubic-bezier(0.2,0,0,1): the leaver turns ±90° and shrinks to 0.5 while fading; the arriver turns in from the opposite side. As the sun arrives its rays extend from the disc one after another (scale 0 → 1, 260ms, 120ms + 28ms per ray). All transitions, so a double-tap reverses mid-turn.
- Hover: a radial wash fades in over 160ms and the glyph lifts 1px and scales 1.06 (180ms). Press: the button scales 0.94 and the glyph 0.92 (90ms).
- Segmented pill travels with `layoutId` on spring(500, 40).
- Reveal: inside `document.startViewTransition`, clip `::view-transition-new(root)` from `circle(0)` to a circle reaching the farthest viewport corner, centred on the pressed control, over 560ms on cubic-bezier(0.65,0,0.35,1). The update promise resolves in a layout effect once React commits the new theme (no flushSync), with a 320ms safety timeout for hosts that ignore the change. Scope the snapshot overrides to a class set on `<html>` only during the reveal. Picking System when it already matches the screen skips the wipe.
- Reduced motion: glyphs and wipe become a 150ms cross-fade; no rotation, rays or lift.

**Accessibility**
- Icon button: `aria-label` names the action ("Switch to light theme"), `aria-pressed` reflects dark, plus a matching `title`.
- Segmented: `role="radiogroup"` labelled "Theme"; segments are `role="radio"` with `aria-checked` and roving tabindex; arrow keys, Home and End move and select. Icon-only segments keep accessible names and tooltips.
- Focus-visible: a 2px ring in the ink colour, offset 2px, no transition. System mode listens to `prefers-color-scheme` changes live.

**Don't**
- Don't animate the whole page with a CSS transition on every colour property, and don't leave global view-transition overrides active outside your own reveal.
- Don't use yellow suns, blue moons, gradient knobs or a skeuomorphic sliding switch with stars.
- Don't wipe when nothing visible changes, and don't block the switch when View Transitions are unavailable.
