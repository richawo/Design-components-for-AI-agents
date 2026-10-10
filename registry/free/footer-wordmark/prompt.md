Build a big studio footer in React + Tailwind CSS (v4, container queries) with `motion/react`. It's a dark slab that ends the page with a closing line, link columns, a newsletter, a live local clock and a giant wordmark fitted exactly to the container and sliced off at the floor. It reveals once as it scrolls into view, choreographed block by block.

**Layout**
- `footer` is the `@container`, in `#050506` with white text. A 1px hairline across the top fades out at both ends. No glow or radial light. The inner container is `max-w-[1440px]` with 20/32/48px side padding and 64/80/96px top padding (`@2xl`, `@5xl`). Everything aligns to the same left and right edges, the wordmark included.
- Row 1: the closing line ("Got a brief, a hunch or a half-built thing?") at max 17ch, then a large mailto link with a 40–48px white circle holding a black arrow. On the right from `@3xl`, a "Back to top" button: a 56px (80px at `@5xl`) circle drawn as an SVG ring (2px white/15%, non-scaling stroke) with an up arrow and a mono label under it. On mobile it sits in a row, circle first.
- Row 2: a 2px `white/15%` rule, 40px of padding, then a grid: 2 columns on mobile, 4 at `@2xl`, 12 at `@6xl` (1152px; at 1024 the 12-column split cramps the clock). Three link columns (Studio, Work, Elsewhere) and a Visit column each take 2 of the 12; the newsletter takes columns 9–12. Below `@6xl` the newsletter spans the full row and splits in two: copy left, form right.
- Row 3: a 1px `white/8%` rule, then the legal line and legal links in mono 11px uppercase, splitting left/right from `@5xl`.
- Row 4: the wordmark, flush with the container's left and right edges, with its bottom edge cutting the letters 14% above the baseline.

**Typography**
- Closing line: display 700, `clamp(2.4rem, 1.3rem + 4.4cqi, 5.5rem)`, leading 0.95, tracking −0.05em.
- Email: display 600, `clamp(1.25rem, 0.9rem + 1.6cqi, 2.25rem)`, tracking −0.035em, with a 2px underline drawn as a background that retracts to the right on hover.
- Column titles: mono 11px uppercase, tracking 0.16em, white/45. Links: 17px medium, tracking −0.015em, at least 36px tall, with a 1.5px underline that grows from the left on hover. External links get ↗, which nudges up and right on hover.
- Newsletter title in semibold sans at 26px, tracking −0.035em ("Low Tide"), body 15px at white/60, max 40ch.
- Clock: a mono label ("Local time · BST") with a pinging white dot (the one ambient signal, running only while on screen), then "London 19:27" in display 22px semibold with tabular figures. The city label is a prop; when it's omitted, derive it from the time zone ("America/New_York" reads "New York") so a custom zone never sits next to the wrong city. It updates on each minute boundary, not every second.
- Wordmark: display (Geist) semibold, tracking −0.065em, lowercase, filled with a vertical metallic gradient (white 90% → zinc-400 50% → zinc-700 5%) so it fades into the black. The gradient id comes from `useId()`.

**Colour**
- Field `#050506`, white type at stepped opacities. Buttons and the subscribe pill are solid white with black text. The input is `white/4%` (7% on focus) with a `white/15%` border; the error border is `#f87171` and the error text `#fca5a5`. Tags ("2 open") are white/8% pills with white/80 mono text. Everything lives in one `COLORS` token object exposed as CSS variables; there is no accent colour.

**The fitted wordmark (the idea)**
- Render it as SVG `<text>` at `fontSize=100`, `x=0 y=0`. On mount and again after `document.fonts.ready`, measure it with a canvas: set `ctx.font` from the text element's computed weight and family at 100px and `ctx.letterSpacing` from its computed tracking, then call `measureText`.
- Set `viewBox = "-actualBoundingBoxLeft  -actualBoundingBoxAscent  inkWidth  ascent × (1 − clip)"` and `width: 100%`. The ink box spans the container edge to edge at every width with no resize listener, and the viewBox stops above the baseline, so the letters sink into the floor.
- Until it's measured, use an estimate (58 units per character, ascent 74) at opacity 0, then fade and rise in (24px, 0.8s, ease [0.2, 0.8, 0.2, 1]).

**Entrance (reveal once, block by block)**
- Four blocks, each revealed when a quarter of it is visible: closing line, column grid, wordmark, legal bar. A shared clock keeps them in order when they arrive together (desktop), while a block scrolled to later (mobile) starts at once instead of waiting out its slot. Items rise 12px out of an 8px blur over 600ms `cubic-bezier(0.22, 1, 0.36, 1)`; rules draw (scaleX, 800ms).
- Closing line (0ms): top hairline draws from the centre; headline words stagger 35ms apart (sr-only full text, words `aria-hidden`); the email at 300ms, its underline drawing left to right; the arrow chip pops in (scale 0.6 → 1) at 420ms; the back-to-top ring draws along its path (`pathLength`, 700ms) from 240ms, then its arrow and label.
- Grid (320ms): the 2px rule draws; columns follow 60ms apart, title first, links 30ms apart. Visit: address, then the live dot pops in and starts pinging, then the clock counts from 00:00 to the local time over 700ms (a motion value, tabular figures, 3px blur clearing as it lands). The newsletter lands last.
- Wordmark (500ms): rises from fully below the floor (translate in viewBox units) over 1.1s on a slow-start curve `cubic-bezier(0.6, 0, 0.2, 1)`, so the climb stays visible even if the first frame of the big type is slow to paint, and fades and sharpens out of an 8px blur over 900ms on the shared ease, once measured.
- Legal bar (620ms): rule draws, the line, then links 30ms apart. It lands last.

**Motion**
- Arrow chips rotate −45° on hover; the email underline retracts to the right. The back-to-top arrow lifts 4px. The newsletter swaps form → success pill (`AnimatePresence mode="wait"`, 8px rise out of a 4px blur, 0.4s, the check draws).
- Reduced motion: 150ms fades only, the clock set instantly; no rise, blur or ping, and back-to-top scrolls instantly.

**Accessibility**
- Each link column is a `nav` with `aria-label`. Use an `address` element and `time dateTime` for the clock.
- The email input has an sr-only label, `aria-invalid`, and an `aria-describedby` pointing at a polite live error. The success message is `role="status"`.
- External links open in a new tab and carry sr-only "(opens in a new tab)". The wordmark SVG is `aria-hidden` (the brand is named elsewhere).
- Visible focus: white/60 rings offset on black.

**Don't**
- Don't size the wordmark with a guessed `vw` value. It must be measured, or it will overflow or fall short.
- No grey footer with four equal columns of small links. Scale and the lit wordmark are the point.
- No social icon row. Socials are text links.
- No glow, accent colours or drop shadows; the only gradients are the fading hairline and the wordmark's metal.
- Don't reveal the whole footer as one block, and don't pulse the clock's colon (one ambient signal only).

**Press feel**
- Every button and link presses: 0.97 for buttons and links, 0.99 for full-width rows, in 150ms, springing back on release. Colour, background and transform share one transition so nothing snaps. Hover changes are a single step, and focus rings appear instantly.
