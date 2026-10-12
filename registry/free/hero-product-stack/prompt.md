Build a SaaS hero in React + Tailwind CSS v4 with `motion/react`. Copy on the left; on the right, a 3D stack of three fully CSS-drawn app windows that tilts toward the pointer. It's for a fictional planning tool, "Cadence: planning for teams who hate planning." Dark first, monochrome, with one signal colour that only marks what is happening now and what just changed. It's the hero section alone: no nav, brand bar or announcement inside it.

**Tokens** (one `PALETTE` object at the top, written to CSS variables on the root; no inline hex in class names)
- Dark (default): page `#0a0a0b`, windows `#141416`, ink `#f4f4f5`, text on ink `#0a0a0b`. Window shadow: a 1px white/8% ring, an inset white/6% top highlight and three soft black drops.
- Light (`theme="light"`): page `#eef0f3`, windows `#ffffff`, ink `#14161a`, text on ink `#ffffff`, softer grey drops.
- Accent: one `accent` prop, default `#ff6a3d`. It colours only the today dot, the now line, the block the thread moved, the "Moved to Thu, 12:00" chip and focus rings. Everything else is ink at an opacity: solid blocks ink/90, muted blocks ink/7%, hatched blocks a dashed ink/20 border over a 135° ink/7% hatch, hairlines ink/5–7%, the burndown line in ink with an ink/7% area.

**Layout**
- `@container` root, container max 1280px, padding 20/32/48px, vertical padding 64/80/112px. From `@5xl` (64rem) a 12-column grid: copy in 5, stack in 7; below that the stack drops under the copy.
- Headline: display semibold `clamp(2.75rem, 1.6rem + 4.6cqi, 5.25rem)`, leading 0.98, tracking −0.05em, one prop string per line ("Planning / for teams / who hate / planning."). The emphasis word is Instrument Serif italic at weight 400, tracking −0.02em. No gradient text.
- Body 17px, leading 1.6, ink/70, max 46ch. Actions: a 52px ink pill with page-coloured text, and a tour link led by a 36px ink/8% play circle with an ink/10 ring. Rating: five ink stars, then "4.8 from 1,900 reviews · Free for teams under 10" at ink/60.

**The stack**
- A fixed 640×560 design stage, scaled to its container by a ResizeObserver into a motion value (no re-render), so the composition never reflows.
- Three layers in `preserve-3d` with 1600px perspective, at translateZ 0, 70 and 140px, radius 14px:
  1. **Week calendar** (560×392): week label, chevrons and a Week / Sprint / Roadmap segmented control; five day columns with today in full ink plus an accent dot and a 3% ink wash; a 40px hour gutter (9:00–18:00, 31px rows); blocks positioned by start and length; an accent now line with a dot. Thursday holds a hatched "No-meeting block" with the accent "Checkout copy rewrite" block inside it.
  2. **Sprint burndown** (290×222): "Sprint 14 burndown", the points left in 30px display tabular figures, an ink/8% "2 days ahead" pill, an SVG chart (three gridlines, a dashed ideal line, the actual line with its area and a dot at the tip) and Day 1 / Today / Day 10.
  3. **Comment thread** (300×236): "# Checkout copy" with a count, two messages with initials avatars inside hairline rings, the accent chip on the last message, and a reply field with an ink send button.

**Entrance** (once, when 20% of the hero is in view; the stack has its own 30% trigger because it sits below the fold on phones; ease `[0.22, 1, 0.36, 1]`; every step starts by 0.75s)
1. Copy first: headline lines rise 12px out of an 8px blur, 500ms each, 65ms apart; body at 0.24s, actions at 0.29s, rating at 0.34s. The stars pop in 40ms apart and the score counts 0 → 4.8 with a 3px blur that clears.
2. Windows, back to front: calendar at 0.22s, burndown at 0.32s, thread at 0.40s, each rising 28px out of an 8px blur over 700ms. Drop the filter at rest (`transitionEnd: { filter: "none" }`) so text stays crisp in 3D.
3. Calendar contents: the header, then hairlines and hour rules draw left to right (15ms apart) while column rules draw down. Blocks drop into their slots column by column, top to bottom (y −6px, scaleY 0.82 → 1, 4px blur, 420ms, 30ms per column and 18ms per block). The now line draws at 0.56s.
4. Burndown: the label and gridlines land, the ideal line fades in, then one progress value (0.44s, 550ms) clips the line and area from the left, moves the tip dot along the line and counts the points down from the sprint total to today's figure, so the number always matches the drawing. The status pill lands as the line finishes.
5. Thread: header, then each message rises 70ms apart while its avatar ring draws along its path, then the composer.
6. Payoff: the accent chip lands at 0.64s and the accent block drops into Thursday from 14px above at 0.72s, so the eye reads the comment moving the work.
- Ambient: each window drifts ±7px on its own 6–8.6s CSS loop, paused offscreen.
- Pointer: the window position maps to −1…1 through springs (stiffness 120, damping 18, mass 0.6): rotateY −20° → −4°, rotateX 14° → 2°. Mouse only.
- Reduced motion: a fixed `rotateX(8deg) rotateY(-12deg)` pose, no drift, everything fades in together over 150ms, and numbers are set instantly.

**Accessibility**
- A real `h1` labels the section. The stage is `role="img"` with an aria-label describing the three windows. Actions are real links with a 2px accent focus ring offset 3px.

**Don't**
- No gradient or tinted headline words, no coloured avatars, tinted event tones or glow blobs.
- No screenshots, hand-drawn scribbles or glassmorphism, and no tilt beyond about 20°.
- No per-frame React state: drive the chart, counters and scale from motion values.

**Press feel**
- Buttons and links press to 0.97 in 150ms and spring back. Hover is one step: the CTA lightens to ink/88, the play circle to ink/14% with a 1px nudge. Focus rings appear instantly.

Secondary text uses at least 65% ink opacity on these surfaces; quiet typography must remain readable in both themes.
