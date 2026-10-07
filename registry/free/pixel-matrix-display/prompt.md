Build a dot-matrix LED display in React + Tailwind CSS v4, drawn on a single `<canvas>` with no dependencies. Think premium hardware: a Nothing-phone glyph panel or a studio clock. Minimal, crisp, quietly alive.

**Panel**
- `#070707` surface, 1px `white/8%` border, 20px radius, padding `clamp(12px, 2.4vw, 22px)`.
- An inset top highlight, an inner vignette (`inset 0 0 40px black/90%`), a deep drop shadow, and a faint top-down glass sheen gradient over the dots.

**Matrix**
- 72 × 16 dots by default. The canvas width fills its container (ResizeObserver), the dot pitch is width ÷ cols, and the height follows.
- Draw at devicePixelRatio, capped at 2.
- Dots are circles with radius 0.34 × pitch. Off dots are `white/5.5%`.
- Lit dots use one colour (default `#f5f5f0`) at 5 brightness levels. Batch each level into a Path2D and fill it once, with `shadowBlur` growing per level for a soft bloom. Never draw the blur per dot.

**Font**
- A hand-written 5×7 bitmap font for A–Z, 0–9 and `: . - / % +`, rendered at 2× when there are 16+ rows.

**Scenes** (each a function `(t, cols, rows) → (x, y) → brightness 0–1`)
1. **Marquee:** text scrolls right to left at 14 dots/s.
2. **Clock:** HH:MM, centred, with a colon blinking at 1Hz. Use a constant width so the digits never shift.
3. **Equaliser:** 2-dot bars with 1-dot gaps, heights from layered sines, a brighter peak dot on top, and a brightness gradient up the bar.
4. **Pulse:** an ECG trace drawing left to right with a fading tail.
5. **Orbit:** a comet arc running round a ring, with a gently breathing centre dot.

**Transitions**
- Scenes change every 4.8s. Each dot has a stable random threshold, and dots switch to the new scene as a 700ms progress passes their threshold, so the display dissolves pixel by pixel.

**Controls**
- Under the panel, in mono 11px uppercase with 0.16em tracking at white/40: "02 / 05 · Clock", plus previous, pause/play and next icon buttons (32px, round hover).

**Performance and accessibility**
- Pause drawing offscreen (IntersectionObserver).
- With reduced motion, freeze the scene time.
- The canvas has `role="img"` and an aria-label describing the current scene.

**Don't**
- No rainbow colours, CRT scanline kitsch or emoji.
- No DOM node per dot.
- No blur per dot.
