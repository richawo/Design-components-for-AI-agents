Build a dot-matrix LED display in React + Tailwind CSS v4 + `motion/react` (for the panel entrance, the scene progress value and caption swaps), drawn on a single `<canvas>`. Think premium hardware: a Nothing-phone glyph panel or a studio clock. Minimal, crisp, quietly alive.

**Panel**
- Root has `@container`. Panel: `#070707` surface, 1px `white/8%` border, 20px radius, padding `clamp(12px, 2.6cqi, 22px)`.
- An inset top highlight, an inner vignette (`inset 0 0 40px black/90%`), a deep drop shadow, and a faint top-down glass sheen gradient over the dots.

**Matrix**
- 72 × 16 dots by default. The canvas width fills its container (ResizeObserver), the dot pitch is width ÷ cols, and the height follows.
- Draw at devicePixelRatio, capped at 2.
- Dots are circles with radius 0.34 × pitch. Off dots are `white/5.5%`.
- Lit dots use one colour (default `#f5f5f0`) at 5 brightness levels. Batch each level into a Path2D and fill it once, with `shadowBlur` growing per level for a soft bloom. Never draw the blur per dot.

**Font**
- A hand-written 5×7 bitmap font for A–Z, 0–9 and `: . - / % +`, rendered at 2× when there are 16+ rows.

**Scenes** (each a function `(t, cols, rows) → (x, y) → brightness 0–1`)
1. **Marquee:** starts with the text at the left edge, then scrolls right to left at 14 dots/s and wraps in from the right.
2. **Clock:** HH:MM, centred. Always rasterise the colon so the minutes never move; let it breathe (a 1Hz cosine fade from 22% to 100%) rather than blink on and off.
3. **Equaliser:** 2-dot bars with 1-dot gaps, a brighter cap dot, a brightness gradient up the bar, and peak-hold dots that hang and then fall. Bars use a meter's ballistics: fast attack, slower release. Idle, heights come from layered sines. A "Use mic" toggle (opt-in, `getUserMedia` + an `AnalyserNode`, fftSize 256) drives the bars from live audio, mapping log-spaced frequency bands to bars so the voice's fundamentals sit on the left; it holds the equaliser scene while listening, shows "Listening" with a pulsing dot, handles a blocked permission gracefully, and stops every track on toggle, scene change or unmount.
4. **Pulse:** an ECG trace drawing left to right with a fading tail.
5. **Orbit:** a comet arc running round a ring, with a gently breathing centre dot.

**Power-on (first view, once at 30% in view; ease-out `[0.22, 1, 0.36, 1]`; timings in one MOTION object)**
- The panel rises 12px out of an 8px blur (0.5s) while its dots stay dark.
- At 0.22s the dots power on in a sweep: a bright column crosses left to right over 0.75s. Each dot's front is `x / cols` with 3.5% per-dot jitter (from its stable noise), so the edge is slightly ragged like real LEDs warming up. Dots ahead of the front are dark (not even the unlit grid), dots inside the 5%-wide band draw at full brightness, dots behind it show the scene.
- Scene time starts once the sweep has passed, so the marquee holds still while the sweep writes "DESIGN" in, then begins to scroll. The caption and controls rise at 0.5s and 0.56s. Auto-advance starts only after power-on.

**Transitions**
- Scenes change every 4.8s, driven by one progress motion value (0 → 1, linear, advancing on complete) that also fills the caption's progress line, so pausing stops both together and resuming continues from where it was. Each dot has a stable random threshold, and dots switch to the new scene as a 700ms progress passes their threshold, so the display dissolves pixel by pixel.

**Controls**
- Under the panel, in mono 11px uppercase with 0.16em tracking at white/40: "02 / 05 · Clock", plus previous, pause/play and next icon buttons (32px, round hover).

**Performance and accessibility**
- Pause drawing offscreen (IntersectionObserver).
- With reduced motion: no autoplay (prev/next still work), no sweep, no pointer glow, 150ms fades; each scene freezes on a representative still (marquee and clock at t = 0, the rest at t = 2).
- The canvas has `role="img"` and an aria-label describing the current scene.

**Don't**
- No rainbow colours, CRT scanline kitsch or emoji. No CSS keyframe progress lines. Never pop in fully lit.
- No DOM node per dot.
- No blur per dot.

**Feel**
- The panel answers the pointer like a real LED board: unlit dots within about four dots of a mouse cursor warm up in the display colour (three levels by distance) and lit dots step up a level. The effect eases in and out (12% per frame).
- Hovering the display holds the current scene, so it can be watched; the auto-advance resumes on leave.
- A 40px progress line beside the scene counter is the scene's progress motion value as `scaleX`; it holds whenever the scene is held or paused.
- The scene label cross-fades on every change (in: 6px, 2px blur, 320ms; out: up 6px, 160ms ease-in). Below `@md` the mic control shrinks to its dot (the aria-label keeps the meaning) so the caption never wraps.
- Code: hooks `useSceneCycle`, `useMicrophone`, `useMatrixCanvas`; sub-components `Caption`, `IconButton`, `MicButton`; everything the draw loop reads (scene index, dissolve start, sweep start, pointer) lives in one ref, never React state. Colours in one PALETTE object as `--pmd-*` variables; the mic's blocked state is `#f87171`.
- Control buttons scale to 0.9 while pressed and have a focus ring.
- Optional `scene` prop: holds the display on that scene (it jumps there when the value changes and auto-advance pauses while it is set; prev and next still step). The progress line fills in the dot colour at 70%.
