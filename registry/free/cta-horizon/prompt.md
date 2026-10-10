Build a closing call-to-action section in React + Tailwind CSS v4 with `motion/react` and a plain 2D canvas. It's a dark panel where light rises over a horizon drawn in ordered dither: one colour reduced to five levels and a Bayer pattern, like a print or an early display. Monochrome silver by default; a single `accent` prop recolours the whole light. Calm, graphic and premium; nothing like the usual glowing blob or a stock orange sunset.

**Panel**
- `@container` on the section (black), with 12 / 20 / 24px padding on an inner box (`@xl`, `@5xl`): a container can't query itself.
- A rounded panel (24px, 32px from `@xl`) in `#09090b`, with an inset top highlight and a 1px `white/6%` ring. Min height 560 / 640 / 700px. Copy is centred; three notes sit at the bottom (`mt-auto`).

**Dither horizon** (decorative, `aria-hidden`, behind the copy)
- Render at cell resolution (one cell = 3 CSS px by default, a `cell` prop) into an offscreen canvas with `ImageData`, then draw it scaled with `imageSmoothingEnabled = false` onto a canvas sized in whole cells (DPR capped at 2). The host clips the overhang so cells stay square.
- Light field per cell, in a pure `shadeField()` function:
  - a wide, flat elliptical glow (rx = 50% of the width, ry = min(36% height, 26% width)), falloff `(1 − d)^2.2 × 1.6`. Its centre sits below the line by a fraction of its own vertical radius (0.78 before the rise, 0.28 after), so it reads the same on a tall phone panel and a wide desktop one;
  - plus a thin haze band hugging the horizon (`exp(−|y − horizon| / 4.5% h)`), fading toward the sides.
- Below the horizon, the field is mirrored (compressed 1.8×) and broken into scanlines: every third row at 10%, the others at 42%, fading with depth.
- Quantise into five levels derived from one accent (`rampFrom(accent)`): panel, `mix(panel, accent, 0.22)`, `mix(panel, accent, 0.5)`, accent, `mix(accent, white, 0.65)`. Default accent `#d9d9d6` (silver). Pick between adjacent levels with an 8×8 Bayer threshold.
- A 1-device-pixel hairline sits on the horizon, white at up to 70% under the sun and fading to nothing 38% either side.
- The horizon is placed 40px above the first note. Measure it with a ResizeObserver on the panel and the notes and again on `document.fonts.ready`; never call `getBoundingClientRect` per frame.
- A top-down fade (panel → 92% at 42% → transparent at 72%) keeps the headline on near-black.

**Entrance (one `T` timeline object, from the moment 35% of the panel is in view, once)**
- Blocks rise 12px out of an 8px blur over 600ms, ease `[0.22, 1, 0.36, 1]`.
- Panel fades in at 0; eyebrow at 0.08, its two hairlines drawing outward at 0.18; headline words from 0.14, 15ms apart, the muted clause a 70ms beat later; body 0.30; primary 0.38; secondary 0.43.
- The light rises from 0.36 over 950ms (ease-out expo): the sun climbs to the line and the levels fade up together.
- Notes land last, 60ms apart from 0.62, under the light.

**Ambient and pointer**
- A faint shimmer multiplies the existing light (±14%, two slow sines), so dark areas stay perfectly clean. It is the one ambient loop.
- The light leans toward a mouse pointer, eased 6% per frame; touch does nothing. A `lean` prop sets how far, as a fraction of the panel width (default 0.12, so the light shifts up to 6% of the width; 0 keeps it centred).
- 30fps is plenty. Pause when offscreen or the tab is hidden. With reduced motion, draw one still frame of the risen light (and redraw it on resize), and fade the copy for 150ms with no transforms or blur.

**Content**
- Eyebrow: mono 11px uppercase, 0.2em tracking, white/55, flanked by two 24px white/25 hairlines.
- Headline: display (Geist), semibold, `clamp(2.5rem, 1.4rem + 4.6cqi, 5.75rem)`, leading 0.98, tracking −0.055em, max 16ch, balanced (words are inline-blocks, so balancing still works). The closing phrase is white/45.
- Body: 16–17px, white/60, max 48ch.
- Buttons (full width and stacked on narrow containers, inline from `@xl`):
  - Primary: white 48px pill, black text, a 1px white/20 ring. Hover is calm: the background dims to `#ececec` and the arrow nudges 2px, 150ms. No glow beneath it, no lift, no growth, no magnetism. Press scales to 0.98.
  - Secondary: dark glass (`black/45`, `backdrop-blur-md`, inset `white/15` ring), so it stays legible if it ever sits on light.
- Notes: three mono 11px uppercase lines at white/60 with a soft dark text-shadow, 3 columns from `@xl`.

**Code**
- Named parts: `Eyebrow`, `Headline`, `PrimaryLink`, `SecondaryLink`, `DitherHorizon`; a `useDitherField` hook owns the canvas (sizing, horizon, rise, lean, loop, cleanup); pure helpers `rampFrom`, `shadeField`, `drawHorizonLine`, `easeOutExpo`. Tuning lives in `COLOR`, `T` and `FIELD` objects.

**Accessibility**
- The canvas is decorative and `aria-hidden`. Focus rings are white, 2px, with a 4px offset. The copy meets AA on the panel.

**Don't**
- No multi-colour sunset ramp, glowing planet arc, purple-blue blob, concentric rings, sparkles, coloured button glow or magnetic buttons.
- Don't let the light reach the headline or body copy, and don't let dither noise fill the dark areas.
