Build a pixel status set for AI agents in React + Tailwind CSS v4: eight animated 9×9 dot-matrix glyphs, rendered as inline SVG with no dependencies. They should read at 16px inline in a chat row and still look crafted at 96px. This is pixel art with discipline: monochrome for work in progress (currentColor, so it follows your text), colour only for the outcomes, a faint unlit grid and 10fps motion.

**API**
- `<PixelStatus state size color grid label replay active />`. `active={false}` holds the glyph dark (grid only) so it can power on once it arrives.
- `state` is one of thinking, searching, writing, listening, syncing, done, error or idle.
- Also export `STATE_COLORS` and a `PixelAgentStatus` gallery.

**Rendering**
- A 90×90 viewBox with 10-unit cells.
- Lit dots are 7.6 units with radius 1.8. Under 28px, use 8.4 and radius 1.2 so small glyphs stay solid.
- With `grid`, unlit cells show at currentColor 7%.
- At 40px and up, a blurred copy of the lit cells (stdDeviation 2.4, 55%) adds a soft LED glow.
- Lit opacity is 25% + 75% × intensity.

**Animation model**
- Each glyph is a pure function `glyph(state, frame)` that returns lit cells and their intensities.
- Render all 81 dots (and, at 40px+, 81 glow cells) once. A `usePixelClock` hook runs a 10fps interval that paints each frame straight into the rects through refs (`setAttribute` fill/opacity), so animating never re-renders React. The first paint comes from props (frame 0, or dark when inactive). Paused offscreen (IntersectionObserver) and in hidden tabs.
- Under reduced motion, show one representative still per state.

**The eight glyphs**
- Thinking: a comet with a 5-step tail (1, .6, .35, .18, .08) circling a 16-cell square around a dim core.
- Searching: a 12-cell lens ring with a 3-pixel handle, drifting on a 1-pixel square loop every 6 frames, with a glint crossing the glass.
- Writing: three lines (7, 5 and 6 pixels) type out with a block cursor blinking every 4 frames, then hold for 14 frames.
- Listening: four mirrored bars on combined sine waves around the middle row, dimming toward their tips.
- Syncing: two 6-cell arcs with bright heads chasing round a 16-cell ring.
- Done: the check draws one pixel per frame, a ring flashes for 6 frames, then it holds. It never loops.
- Error: a centred exclamation that shakes ±1px for 6 frames every 3 seconds.
- Idle: a sleep light. A soft core (centre dot, its four neighbours at 62%, diagonals at 32%) breathes on a 4s cosine from 22% to 100%; a faint four-dot halo appears only near the top of each breath. Never fully dark.

**Colour (monochrome first)**
- Thinking, searching, writing, listening and syncing draw in `currentColor`: white on a dark surface, ink on a light one, and they inherit whatever text they sit beside.
- Idle is a quiet grey `#a1a1aa`. Only the outcomes carry colour: done `#34d399`, error `#f87171`. Export these as `STATE_COLORS`; `color` overrides per glyph.

**Gallery demo**
- Card `#0b0b0c`, 1px white/8% border, radius 22px, `@container`, tokens in one PALETTE object (ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`).
- Header: a mono eyebrow ("Pixel status · 9×9") and a balanced Geist 500 title at `clamp(1.5rem, 1.1rem + 1.6cqi, 2rem)`.
- A live run pill shows the glyph at 18px with no grid next to "Atlas · Reading the Postgres 17 release notes…". It cycles through a five-step run every 2.6s (starting once the gallery has landed) and is aria-live polite.
- Below, a 4×2 grid of tiles (2×4 in narrow containers). The hairlines between tiles are each tile's own 1px ring into a 1px gap, so they arrive with the tiles. Each tile has a 96px glyph in ink, its name, a small dot in the state colour (grey for work in progress), a short note and a mono `state="…"`.

**Gallery entrance (once at 20% in view; ease-out `[0.22, 1, 0.36, 1]`)**
- The card rises 12px out of an 8px blur (0.45s); eyebrow, title and run pill follow 60ms apart.
- Tiles from 0.2s, 40ms apart in reading order, each rising out of the blur. Each glyph powers on from frame 0 (its `active` flips) 0.12s after its tile starts, so the set lights up in a wave and done draws its check as it arrives.
- Reduced motion: 150ms fades, one still per glyph.

**Gallery feel**
- Each tile is a button. Hovering or focusing it replays its glyph from frame one (a `replay` prop), scales the glyph to 1.04 (300ms, ease-out), lifts the tile surface a step and draws a hairline across its top edge (grey, or the outcome colour).
- Clicking copies `<PixelStatus state="…" />`; the mono line slides up to a white "Copied snippet" for 1.4s, then back. Tiles scale to 0.985 while pressed.
- In the live run pill, each step slides up out of focus (10px, 3px blur, 200ms ease-in) as the next slides in (320ms ease-out).

**Accessibility**
- Each glyph is `role="img"` with a label: Thinking, Searching, … Needs attention.
- Shape and text always accompany colour.

**Avoid**
- GIFs or sprite sheets.
- Emoji.
- Sparkle icons.
- Multi-colour glyphs, or a different hue per work-in-progress state.
- Smooth tweening that breaks the pixel feel.
- A looping done state.
