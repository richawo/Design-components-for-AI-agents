Build a Swiss (International Typographic Style) conference hero in React + Tailwind CSS v4 with `motion/react` for the entrance. A black poster with white ink and one signal red, with a `theme` prop for the white-paper inverse. Every element visibly sits on a 12-column grid, and the rigour is the whole point.

**Tokens** (one object at the top of the file, written to CSS variables on the root)
- Dark (default): background `#0a0a0a`, ink `#f4f4f2`, text on ink `#0a0a0a`.
- Light: background `#ffffff`, ink `#0a0a0a`, text on ink `#ffffff`.
- Accent: one `accent` prop, default `#e10600`. It's used for the quarter circle, the hover underline, the hover arrow, the hovered button fill and focus rings. Nothing else is coloured.
- Use the variables everywhere (`bg-(--sg-ink)`, `text-(--sg-ink)/70`); no inline hex in class names.

**Grid**
- `@container` on the root; every breakpoint is a container variant, so it works in a column as well as full width.
- Container max 1440px, side padding 20/32/48px (`@xl`, `@5xl`).
- Content and guides share one grid: 4 columns (gap 16px) by default, 12 columns (gap 24px) from `@3xl` (48rem).
- With `showGrid`, the guides render as full-height columns with ink hairline borders at 7% and a 1.5% fill.

**Meta row**
- Four mono 11px uppercase cells (tracking 0.08em), 3 columns each on wide containers and 2 on narrow ones.
- The first cell is semibold, the rest at 70%. A 1px ink rule sits underneath.

**Headline and shape**
- Headline: Geist bold, lowercase, `clamp(3.6rem, 0.9rem + 12.2cqi, 11.5rem)` from `@3xl` (19cqi below), leading 0.86, tracking −0.065em, one short line per row ("the grid / sets you / free."). It spans columns 1–8 and is optically pulled left by 0.04em.
- An accent quarter circle (SVG path `M100 0V100A100 100 0 0 1 0 0Z`, centred on its top-right corner) fills columns 9–12. On narrow containers it moves above the headline into columns 3–4, and the headline tucks up under it by 7cqi.

**Intro row**
- Body (17px, 1.55 leading, max 38ch) in columns 1–4.
- Actions in 5–8: a square ink button 56px tall with background-coloured text (it fills with the accent and white text on hover, the arrow shifts 4px) and an underlined secondary link.
- Mono notes (early rate, students) in 9–11 at 70%.

**Index**
- A `nav` labelled "Index". A header row of mono column labels sits over a 1px ink rule.
- Rows are links:
  - the number in mono 13px, which turns accent on hover;
  - the track title in Geist semibold `clamp(1.35rem, 1rem + 1.4cqi, 2.25rem)` with a 2px accent underline (a background-size gradient) that grows left to right on hover in 400ms;
  - the speaker at 15px/75%;
  - the time in mono 11px/60%, with an accent arrow that slides in on hover.
- Rows are separated by ink hairlines at 25%. On narrow containers, speaker and time stack under the title.

**Entrance** (once, when 20% is in view; ease `[0.22, 1, 0.36, 1]`; every step starts by ~0.8s)
1. Containers: the 12 guides drop in from the top (scaleY 0 → 1 plus fade, 700ms, 20ms apart), and the meta rule draws left to right (scaleX, 700ms).
2. Text: meta cells rise 12px out of an 8px blur (600ms, 60ms apart), then the headline lines, one after another (from 0.16s, 72ms apart).
3. Figure: the quarter circle grows from its own corner (scale 0 → 1, 700ms, at 0.38s). No rotation, no overshoot.
4. The intro, actions and notes rise from blur at 0.44s, 60ms apart.
5. The index header rule draws, the labels fade up, then each row rises from blur 60ms apart while its hairline draws from the left.
- Reduced motion: everything fades in together over 150ms; no transforms, blur or stagger.

**Accessibility**
- Real `h1`, `nav` and `ol` of links. Focus outlines 2px in the accent, offset 3px, shown instantly.
- The shape and guides are `aria-hidden`.

**Don't**
- No centred text, rounded buttons, extra colours, shadows or gradients.
- No rotate-in or bouncing shape, no stock "conference" photography.
- Nothing off the grid.

**Press feel**
- Buttons and links press to 0.97, index rows to 0.99, in 150ms, springing back on release. Colour and transform share one transition so nothing snaps. Hover changes are a single step, and focus rings appear instantly.
