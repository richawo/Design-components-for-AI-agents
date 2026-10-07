Build a Swiss (International Typographic Style) conference hero in React + Tailwind CSS v4 with `motion/react` for one entrance. White, black and one signal red. Every element visibly sits on a 12-column grid, and the rigour is the whole point.

**Grid**
- Container max 1440px with 20/32/48px side padding.
- Content and guides share one grid: 4 columns (gap 16px) on mobile, 12 columns (gap 24px) from md.
- With `showGrid`, the guides render as full-height columns with `#0a0a0a` hairline borders at 6% and a 1.2% fill, so the structure is visible behind everything.

**Meta row**
- Four mono 11px uppercase cells (tracking 0.08em), 3 columns each on desktop and 2 on mobile.
- The first cell is semibold, the rest at 70%. A 1px black rule sits underneath.

**Headline and shape**
- Headline: Geist bold, lowercase, `clamp(3.6rem, 0.9rem + 12.2vw, 11.5rem)` from md (19vw on mobile), leading 0.86, tracking −0.065em, one short line per row ("the grid / sets you / free."). It spans columns 1–8 and is optically pulled left by 0.04em.
- A red `#e10600` quarter circle (SVG path, square aspect) fills columns 9–12 at the top right. On mobile it moves above the headline into columns 3–4, and the headline tucks up under it.
- The quarter circle enters once: scale 0 → 1 and rotate −90° → 0° from its top-right corner over 1.2s, ease [0.7, 0, 0.2, 1].

**Intro row**
- Body (17px, 1.55 leading, max 38ch) in columns 1–4.
- Actions in 5–8: a square black button 56px tall (turns red on hover, the arrow shifts 4px) and an underlined secondary link.
- Mono notes (early rate, students) in 9–11.

**Index**
- A `nav` labelled "Index". A header row of mono column labels sits over a 1px black rule.
- Rows are links:
  - the number in mono 13px, which turns red on hover;
  - the track title in Geist semibold `clamp(1.35rem, 1rem + 1.4vw, 2.25rem)` with a 2px red underline that grows left to right on hover (500ms);
  - the speaker at 15px/75%;
  - the time in mono 11px/60%, with a red arrow that slides in on hover.
- Rows are separated by 25% hairlines. On mobile, speaker and time stack under the title.

**Accessibility**
- Real `h1`, `nav` and `ol` of links. Focus outlines in red.
- With reduced motion, the quarter circle appears without animating.

**Don't**
- No centred text, rounded buttons, extra colours, shadows or gradients.
- No stock "conference" photography.
- Nothing off the grid.
