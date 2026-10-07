Build a closing call-to-action section in React + Tailwind CSS v4 with `motion/react`. It's a dark panel where a luminous planet-edge horizon rises from the bottom. Cinematic, calm and premium.

**Panel**
- Black page with 12–24px padding. A rounded panel (24px, 32px from sm) in `#09090b`, with an inset top highlight and a 1px `white/6%` ring.
- Min height 560 / 640 / 700px.
- A film-grain overlay (SVG feTurbulence data URI, 8% opacity, `mix-blend-overlay`) stops the gradient banding.

**Horizon** (decorative, `aria-hidden`)
- A huge radial bloom (core `#ffe2c4` → `#ff7a45` at 80% → `#ff4d6d` at 33% → transparent), blurred 40px at 55% opacity. Its centre sits below the panel's bottom edge so only the top of the glow shows.
- Over it, an SVG anchored to the bottom (`preserveAspectRatio xMidYMax slice`):
  - three faint concentric ellipse outlines (white at 7%, 5% and 3%);
  - a dark disc (the planet) filled with a subtle radial gradient;
  - a 2px rim stroke with a horizontal gradient that's hottest at the centre and fades to transparent at both ends.
- The bloom rises 60px and fades in over 1.6s when the panel enters view.

**Content** (centred)
- Eyebrow pill: `white/3%` fill, `white/10%` border, a pinging accent dot, mono 11px uppercase with 0.18em tracking at white/60.
- Headline: display (Geist), semibold, `clamp(2.5rem, 1.4rem + 4.6vw, 5.75rem)`, leading 0.98, tracking −0.055em, max 16ch, balanced.
- The lead clause carries a subtle white → white/70 vertical gradient; the closing phrase is solid white/45.
- The headline enters with a blur (8px → 0), a 24px rise and a fade over 0.9s.
- Body: 16–17px, white/60, max 50ch.
- Buttons:
  - primary is a white 48px pill with black text and a soft white glow. It's magnetic: it leans up to 18px toward the cursor on a spring (stiffness 220, damping 18), and its label and arrow travel 40% further for depth.
  - secondary is a glass pill (`white/6%`, hairline ring).
  - Both go full width on mobile.
- Notes: three reassurance lines pinned to the bottom (mono numerals 01–03 at white/30, text 13px white/55), in 3 columns from sm.

**Accessibility**
- The magnetic effect is mouse-only and disabled with reduced motion, which also skips the entrance animations.
- Focus rings are white.

**Don't**
- No flat saturated background, concentric target rings over the copy, yellow-on-blue or sparkles.
- The glow is light falling on a surface, not a purple-blue blob.
