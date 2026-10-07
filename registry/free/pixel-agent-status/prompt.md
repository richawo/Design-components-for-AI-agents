Build a pixel status set for AI agents in React + Tailwind CSS v4: eight animated 9×9 dot-matrix glyphs, rendered as inline SVG with no dependencies. They should read at 16px inline in a chat row and still look crafted at 96px. This is pixel art with discipline: one colour per state, a faint unlit grid and 10fps motion.

**API**
- `<PixelStatus state size color grid label />`.
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
- A 10fps interval advances the frame, paused offscreen (IntersectionObserver) and in hidden tabs.
- Under reduced motion, show one representative still per state.

**The eight glyphs**
- Thinking: a comet with a 5-step tail (1, .6, .35, .18, .08) circling a 16-cell square around a dim core.
- Searching: a 12-cell lens ring with a 3-pixel handle, drifting on a 1-pixel square loop every 6 frames, with a glint crossing the glass.
- Writing: three lines (7, 5 and 6 pixels) type out with a block cursor blinking every 4 frames, then hold for 14 frames.
- Listening: four mirrored bars on combined sine waves around the middle row, dimming toward their tips.
- Syncing: two 6-cell arcs with bright heads chasing round a 16-cell ring.
- Done: the check draws one pixel per frame, a ring flashes for 6 frames, then it holds. It never loops.
- Error: a centred exclamation that shakes ±1px for 6 frames every 3 seconds.
- Idle: a 4×4 "z" rises diagonally and fades on a sine envelope over 2.2s, then rests.

**Colour**
- Work in progress is warm: thinking and listening `#ff7a45`, searching `#ffb38a`, writing `#f4efe9`.
- Outcomes are semantic: done `#34d399`, error `#fb7185`.
- Syncing is cool `#9cc9ff`; idle is warm grey `#8a8580`.

**Gallery demo**
- Card `#0b0b0c`, radius 22px.
- Header: a mono eyebrow ("Pixel status · 9×9") and a balanced Geist 500 title.
- A live run pill shows the glyph at 18px with no grid next to "Atlas · Reading the Postgres 17 release notes…". It cycles through a five-step run every 2.6s and is aria-live polite.
- Below, a 4×2 grid of tiles (2×4 in narrow containers) with 1px gaps. Each tile has a 96px glyph, its name, a colour dot, a short note and a mono `state="…"`.

**Accessibility**
- Each glyph is `role="img"` with a label: Thinking, Searching, … Needs attention.
- Shape and text always accompany colour.

**Avoid**
- GIFs or sprite sheets.
- Emoji.
- Sparkle icons.
- Multi-colour glyphs.
- Smooth tweening that breaks the pixel feel.
- A looping done state.
