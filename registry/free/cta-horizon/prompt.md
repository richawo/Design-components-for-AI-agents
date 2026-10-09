Build a closing call-to-action section in React + Tailwind CSS v4 with `motion/react` and a plain 2D canvas. It's a dark panel where a sunrise is drawn in ordered dither: light reduced to a few colours and a Bayer pattern, like a print or an early display. Calm, graphic and premium; nothing like the usual glowing blob.

**Panel**
- Black page with 12–24px padding. A rounded panel (24px, 32px from sm) in `#09090b`, with an inset top highlight and a 1px `white/6%` ring.
- Min height 560 / 640 / 700px. Copy is centred; three notes sit at the bottom (`mt-auto`).

**Dither sunrise** (decorative, `aria-hidden`, behind the copy)
- Render at cell resolution (one cell = 3 CSS px by default, a `cell` prop) into an offscreen canvas with `ImageData`, then draw it scaled with `imageSmoothingEnabled = false` onto a canvas sized in whole cells (DPR capped at 2). The host clips the overhang so cells stay square.
- Light field per cell:
  - a wide, flat elliptical glow (rx = 50% of the width, ry = min(36% height, 26% width)) whose centre sits just below the horizon line, falloff `(1 − d)^2.2 × 1.6`;
  - plus a thin haze band hugging the horizon (`exp(−|y − horizon| / 4.5% h)`), fading toward the sides.
- Below the horizon, the field is mirrored (compressed 1.8×) and broken into scanlines: every third row at 10%, the others at 42%, fading with depth.
- Quantise into five levels: panel black, the outer colour pulled 45% toward black, outer, mid, core (defaults `#ff4d6d`, `#ff7a45`, `#ffe2c4`). Pick between adjacent levels with an 8×8 Bayer threshold, so gradients become ordered dot patterns.
- A 1-device-pixel hairline sits on the horizon, white at up to 70% under the sun and fading to nothing 38% either side.
- The horizon is placed 40px above the first note, measured every frame, so the light always sits between the buttons and the notes and never under the copy.
- A top-down fade (`#09090b` → 92% at 42% → transparent at 72%) keeps the headline on near-black.

**Motion**
- On first view the sun rises into place over 1.8s (ease-out expo) while the light fades up.
- A faint shimmer multiplies the existing light (±14%, two slow sines), so dark areas stay perfectly clean; never add light where there is none.
- The light leans up to 6% of the width toward a mouse pointer, eased; touch does nothing.
- 30fps is plenty. Pause when offscreen or the tab is hidden. With reduced motion, draw one still frame (on resize too).
- Copy: the eyebrow fades in, the headline enters with a blur (8px → 0) and an 18px rise over 0.9s, the body and buttons follow at 120ms and 200ms, the notes 80ms apart after 500ms.

**Content**
- Eyebrow: mono 11px uppercase, 0.2em tracking, white/55, flanked by two 24px hairlines.
- Headline: display (Geist), semibold, `clamp(2.5rem, 1.4rem + 4.6vw, 5.75rem)`, leading 0.98, tracking −0.055em, max 16ch, balanced. The closing phrase is white/45.
- Body: 16–17px, white/60, max 48ch.
- Buttons (full width on mobile):
  - Primary: white 48px pill, black text. Hover only warms the light under it (a blurred accent glow fades in beneath the button) and nudges the arrow 2px. No magnetism, no lift. Press scales to 0.98.
  - Secondary: dark glass (`black/45`, `backdrop-blur-md`, inset `white/14%` ring), so it stays legible if it ever sits on light.
- Notes: three mono 11px uppercase lines at white/55 with a soft dark text-shadow, 3 columns from sm.

**Accessibility**
- The canvas is decorative and `aria-hidden`. Focus rings are white with a 4px offset. The copy meets AA on the panel.

**Don't**
- No glowing planet arc, purple-blue blobs, concentric rings, sparkles or magnetic buttons.
- Don't let the light reach the headline or body copy, and don't let dither noise fill the dark areas.
