Build a text decode effect in React + Tailwind CSS v4 (`motion/react` only for `useReducedMotion`). Characters scramble and resolve left to right, on first view and on hover or keyboard focus. It should feel like a signal locking on, not a hacker movie: quiet, quick, typographic.

**The signature: nothing reflows**
- Split the text into one inline `span` per character (never `inline-block`, so words still wrap at spaces). Each holds two layers: the real character, always in the flow, which reserves the exact final width from the first frame; and an absolutely positioned overlay (`inset 0`, flex-centred on both axes, which lands its baseline exactly on the real character’s whatever the line-height) that shows the scramble glyph. Only opacities and the overlay's text change, so the line never moves, even in a proportional display face.
- Drive it from one `requestAnimationFrame` loop that writes to the DOM directly (no React render per frame).
- When a character resolves, the overlay shows the final character in the flash colour (`#ffffff` by default, with `text-shadow 0 0 12px` at 30% (`color-mix`)) and fades from 1 to 0 over 560ms `cubic-bezier(0.22, 1, 0.36, 1)` via WAAPI. That brief brightness is the "landing".

**Timing**
- `speed` is characters per second for the resolving edge (default 32). Stagger = min(1000 / speed, 1100 / length), so long lines never take more than ~1.1s.
- Each character scrambles for a lead of clamp(stagger × 7, 170, 380)ms before it resolves, so a band of 7–10 scrambling characters travels ahead of the edge.
- Glyphs change every 56ms per character with a per-character phase offset, chosen by a stable integer hash (never `Math.random` per frame), and never equal to the final character.
- Scramble glyphs render in the current colour at 50% opacity.

**Glyph sets (curated, not Unicode noise)**
- `auto` (default) is case-aware: lowercase cycles `abcdeghknopqrsuvxyz`, capitals `ABCDEFGHKLNOPRSTUVXYZ` (mid-width letters only, no i/l/j or m/w, so glyphs stay inside the final character’s box even in a proportional face), digits `0–9`. Punctuation and spaces never scramble, so words keep their silhouette.
- Presets: `symbols` `#%&*+=-/\<>[]{}|:;_~`, `blocks` `░▒▓▖▗▘▝▚▞▙▛▜▟`, `binary` `01`, `hex` `0–F`. Any other string is used as the set.

**Triggers**
- `view`: IntersectionObserver at 30%, once, with an optional `delay`. The first render is the hidden pre-reveal state so server HTML never flashes the final text; characters appear only when the edge reaches them.
- `hover`: pointer enter and `:focus-visible` focus on the nearest `a`, `button` or `[data-decode-trigger]` ancestor (or the element itself). A scramble band sweeps through the visible text. Ignored while a decode is running.
- Changing `text` morphs the old value into the new one: characters that are unchanged at the same index stay put; each changed old character holds its place until the wave reaches it, then scrambles into the new one. A ticking status line only decodes the part that changed. `replayKey` replays on demand.

**Demo (dark stage, `#000`)**
- Max width 960px, left aligned. Mono eyebrow 11px uppercase, tracking 0.18em, white/45: "Observation log · Dish 04 / 07".
- Heading in the display face, `clamp(2.75rem, 1.1rem + 6.2vw, 6.5rem)`, weight 500, leading 0.95, tracking −0.045em: "Signal found / at 1420 MHz." (view, 26 cps, 160ms delay).
- Status line in mono 13px white/60 with a mint `#7dd3a8` live dot, binary glyphs; it takes a new reading every 4.2s (paused offscreen and in hidden tabs) and decodes it.
- Hairline `white/9%` rule, then a nav of four mono uppercase links (12px, tracking 0.14em, white/55 → white, numbered 01–04 in white/25 → mint) that decode with `symbols` on hover/focus; 44px tall targets. A ghost "Replay" pill on the right.

**Accessibility**
- Screen readers get the full text once from an `sr-only` span; the per-character layer is `aria-hidden`.
- Reduced motion: show the final text immediately, no scramble on hover or text change.

**Don't**
- No random Unicode, emoji or katakana rain. No colour cycling, no blur, no glow beyond the 560ms landing flash. No layout shift. No per-frame React state.
