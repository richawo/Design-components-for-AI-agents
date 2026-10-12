Build a black site footer in React + Tailwind CSS v4 (`motion/react` for the text entrances) whose giant wordmark is a field of monospace characters drawn on a 2D canvas. The cursor is a lens: under it the glyphs scramble, brighten and thicken. Everything else stays quiet.

**Layout**
- `<footer>` is the `@container`, `bg-black`, `overflow-hidden`. Content column max-width 1440px, gutters 20px → 40px at `@2xl`.
- Top row (above the wordmark), separated from the page by a `white/8%` top rule that draws in: left, a mono kicker (11px uppercase, tracking .16em, `white/40`) and a sign-off at 17px / 1.5, `white/80`, max 34ch; right, a compact row of links (14.5px, `white/60`, 36px tall). Below `@4xl` the two stack; below `@lg` the links become a 3-column grid of 44px targets. Padding 40–56px top and bottom.
- The canvas spans the full footer width. The *ink* aligns to the content column (measure an invisible copy of the column with the same max-width and gutters), so the wordmark lines up with the text above while the faint dot field runs edge to edge.
- Below 560px the word is drawn stacked (`["field", "note"]`) so it keeps enough rows to stay legible.
- Under the canvas: mono 11px uppercase legal line and links (`white/40`), and on the right a small hint with a 6px accent dot: "Move across the mark" (hover devices) or "Drag across the mark" (touch). Hidden with reduced motion.

**The field**
- Cell font: Geist Mono 500 at `clamp(6.5px, width/150, 10px)` × DPR (cap 2). Cell width = `ceil(measureText("M"))`, height = `round(fs × 1.22)`, in integer device pixels.
- Rasterise: render each word once at 200px in Geist 800 (−8px tracking) on a scratch canvas, scan its pixels for the true ink box (no reliance on font metrics), then `drawImage` that box into a sample canvas with 4 samples across each cell (`setTransform(4/cw, 0, 0, SY/ch)`). Average alpha per cell = coverage. Multiply coverage by `1 − 0.34·(row/rows)^1.3` so density thins toward the floor.
- Ramp (lightest first): `" .·:-=+*#%@"`. Level = `1 + round(v^0.85 × (n−2))`; empty cells show `·` at 7% alpha, giving a faint dot field.
- Ink alpha = `(0.3 + 0.66·v^0.9 + (seed − 0.5)·0.12) × (1 − 0.3·(row/rows)^1.4)`: a little per-cell grain and light falling toward the floor.
- Glyph atlas: every glyph drawn once at device resolution in two rows (ink `#ece9e2`, accent `#ff7a3d`). Every cell is then one `drawImage` at integer device pixels, so text stays crisp at any DPR. The resting field is cached in a base canvas; each frame blits it and redraws only the cells the lens or shimmer touch (clear the cell rect first; a per-frame stamp array prevents double work).

**Motion**
- Lens: radius `clamp(width × 0.085, 84, 150)` px. Position lerps 0.22 per frame toward the pointer; strength eases in at 0.12 and out at 0.07. Falloff `f = (1 − d²/R²)² × strength`. Density rises: `v' = v + f·(0.3 + 0.55v)` (empty cells pick up `.` and `:`). Alpha `+ f × 0.4`. Each cell scrambles through `/\|<>{}[]=+*#%&$@01?` with probability `f^1.3 × 0.85`, re-rolling at about 9 Hz on its own phase; scrambled ink cells with `f > 0.45` turn accent.
- Idle shimmer (the one ambient signal): every 10s a soft diagonal band (Gaussian, width 6% of the columns, slanted 0.45 col/row) crosses the ink over 6.5s, lifting alpha by up to 0.28 and occasionally flipping a glyph. Fades out while the lens is active.
- Entrance, once, in three blocks that each reveal at 25% visible and share one clock (blocks arriving together play in order; one scrolled to later starts at once). Text rises 12px out of an 8px blur over 600ms `cubic-bezier(0.22, 1, 0.36, 1)`.
  - Top row (0ms): the rule draws left to right (scaleX, 800ms), kicker at 60ms, sign-off at 120ms, links from 200ms, 35ms apart.
  - Field (300ms): the canvas stays blank until its slot, then cells resolve in a noisy left-to-right sweep over 1.0s (ease-out cubic; threshold = 55% column position + 45% per-cell noise), scrambling (accent in the first 7%) just before they land. The lens and shimmer start once the sweep is done.
  - Legal bar (600ms, lands last): legal line, links 50ms apart, the hint, then its accent dot pops in.
- Pause the loop offscreen (IntersectionObserver at 15%) and in hidden tabs. Rebuild on width change only. Reduced motion: one static frame, no lens, no shimmer, no sweep; the text appears immediately.

**Code**
Keep the field in small pure functions: `rasterise` (one word → true ink box), `buildField` (grid, coverage, grain, atlas, cached resting layer), `drawReveal`, `drawLens`, `drawShimmer`, `drawCell`; a `useLensPointer` hook for mouse and touch; and a thin `AsciiField` component that wires build, ResizeObserver, IntersectionObserver and the rAF loop. Tuning numbers live in one `FIELD` object, the entrance in one `T` timeline.

**Touch**
`touch-action: pan-y`. Pointer down places the lens immediately; horizontal drags move it; vertical drags still scroll the page (pointercancel lifts the lens). Release fades it out.

**Accessibility**
The canvas is `role="img"` with "fieldnote wordmark drawn in characters". Links are real anchors in a labelled `nav` with a 2px `white/70%` focus outline; hovering one dims its siblings to `white/40%`. External links announce "(opens in a new tab)".

**Don't**
- No green-on-black Matrix rain, no katakana, no CRT scanlines or glow.
- No per-frame `fillText` over the whole grid, no WebGL for this.
- Don't let the wordmark touch the viewport edges; align it to the column.
- Don't scramble the whole field at rest; the lens is the drama.
