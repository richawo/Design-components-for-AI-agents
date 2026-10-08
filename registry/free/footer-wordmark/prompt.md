Build a big studio footer in React + Tailwind CSS (v4) with `motion/react`. It's a dark, quietly lit slab that ends the page with a closing line, link columns, a newsletter, a live local clock and a giant wordmark fitted exactly to the container and sliced off at the floor.

**Layout**
- `footer` in `#050506` with white text. A 1px hairline across the top fades out at both ends, and a soft white radial light (8%) rises from below the bottom edge. The inner container is `max-w-[1440px]` with 20/32/48px side padding and 64/80/96px top padding. Everything aligns to the same left and right edges, the wordmark included.
- Row 1: the closing line ("Got a brief, a hunch or a half-built thing?") at max 17ch, then a large mailto link with a 40–48px white circle holding a black arrow. On the right from `md`, a "Back to top" button: a 56px (80px at lg) 2px-ink-ring circle with an up arrow and a mono label under it. On mobile it sits in a row, circle first.
- Row 2: a 2px `white/15%` rule, 40px of padding, then a grid: 2 columns on mobile, 4 at `sm`, 12 at `lg`. Three link columns (Studio, Work, Elsewhere) and a Visit column each take 2 of the 12; the newsletter takes columns 9–12. At `sm`–`md` the newsletter spans the full row and splits in two: copy left, form right.
- Row 3: a 1px `white/8%` rule, then the legal line and legal links in mono 11px uppercase, splitting left/right from `lg`.
- Row 4: the wordmark, flush with the container's left and right edges, with its bottom edge cutting the letters 14% above the baseline.

**Typography**
- Closing line: display 700, `clamp(2.4rem, 1.3rem + 4.4vw, 5.5rem)`, leading 0.95, tracking −0.05em.
- Email: display 600, `clamp(1.25rem, 0.9rem + 1.6vw, 2.25rem)`, tracking −0.035em, with a 2px underline drawn as a background that retracts to the right on hover.
- Column titles: mono 11px uppercase, tracking 0.16em, white/45. Links: 17px medium, tracking −0.015em, at least 36px tall, with a 1.5px underline that grows from the left on hover. External links get ↗, which nudges up and right on hover.
- Newsletter title in semibold sans at 26px, tracking −0.035em ("Low Tide"), body 15px at white/60, max 40ch.
- Clock: a mono label ("Local time · BST") with a pinging white dot, then "London 19:27" in display 22px semibold with tabular figures and a pulsing colon.
- Wordmark: display (Geist) semibold, tracking −0.065em, lowercase, filled with a vertical metallic gradient (white 90% → zinc-400 50% → zinc-700 5%) so it fades into the black.

**Colour**
- Field `#050506`, white type at stepped opacities. Buttons and the subscribe pill are solid white with black text. The input is `white/4%` (7% on focus) with a `white/15%` border; the error border is `#f87171` and the error text `#fca5a5`. Tags ("2 open") are ink pills with chartreuse mono text.

**The fitted wordmark (the idea)**
- Render it as SVG `<text>` at `fontSize=100`, `x=0 y=0`. On mount and again after `document.fonts.ready`, measure it with a canvas: set `ctx.font` from the text element's computed weight and family at 100px and `ctx.letterSpacing` from its computed tracking, then call `measureText`.
- Set `viewBox = "-actualBoundingBoxLeft  -actualBoundingBoxAscent  inkWidth  ascent × (1 − clip)"` and `width: 100%`. The ink box spans the container edge to edge at every width with no resize listener, and the viewBox stops above the baseline, so the letters sink into the floor.
- Until it's measured, use an estimate (58 units per character, ascent 74) at opacity 0, then fade and rise in (24px, 0.8s, ease [0.2, 0.8, 0.2, 1]).

**Motion**
- Wordmark reveal as above. The newsletter swaps form → success pill (`AnimatePresence mode="wait"`, 8px rise, 0.4s). Arrow chips rotate −45° on hover. The back-to-top arrow lifts 4px.
- Reduced motion: no rise, no ping, no pulsing colon, and back-to-top scrolls instantly.

**Accessibility**
- Each link column is a `nav` with `aria-label`. Use an `address` element and `time dateTime` for the clock.
- The email input has an sr-only label, `aria-invalid`, and an `aria-describedby` pointing at a polite live error. The success message is `role="status"`.
- External links open in a new tab and carry sr-only "(opens in a new tab)". The wordmark SVG is `aria-hidden` (the brand is named elsewhere).
- Visible focus: white/60 rings offset on black.

**Don't**
- Don't size the wordmark with a guessed `vw` value. It must be measured, or it will overflow or fall short.
- No grey footer with four equal columns of small links. Scale and the lit wordmark are the point.
- No social icon row. Socials are text links.
- No gradients and no drop shadows.

**Press feel**
- Every button and link presses: 0.97 for buttons and links, 0.99 for full-width rows, in 150ms, springing back on release. Colour, background and transform share one transition so nothing snaps. Hover changes are a single step, and focus rings appear instantly.
