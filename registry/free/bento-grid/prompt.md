Build a live bento grid for a fictional analytics product, “Northstar”, in React + Tailwind CSS (v4) + `motion/react` (+ `lucide-react` for one Search icon). Six tiles, each with a small working illustration drawn in markup, in black and white with one signal accent. It should read like a Swiss product poster, and every tile should choreograph itself in when it arrives.

**Layout**
- One focused component: the grid. No marketing header by default; an optional header (eyebrow with a 6px ink dot, heading with a muted second clause, intro, underlined link) renders only when `heading` is passed.
- Root `section` with `@container`, theme tokens written as `--bn-*` CSS variables. Inner `max-w-7xl`, padding 16/32/48px, vertical 40/64/80px.
- The hairline sheet: a grid with `gap-px` and no backing colour. Each tile carries `box-shadow: 0 0 0 1px var(--bn-rule)` in a solid rule colour, so neighbouring rings fill the 1px gap and the rules arrive with their tiles (a translucent backing would show as a grey slab while tiles fade in). 1px outer border in the rule colour, radius 22px, overflow hidden. Tiles have no radius and no shadow.
- Columns via container queries: 1 → 2 at `@3xl` → 6 at `@5xl`. Spans at `@5xl`: Trend 4 + Stat 2, Heatmap 3 + Search 3, Alerts 2 + Map 4. At `@3xl`: Trend and Map span 2.
- Every tile: padding 24/32px; mono label (“01 / Trends”), display title 22–24px, body 15px/1.55 at 68% ink; the illustration is pushed down with `mt-auto`.
- Export each tile (`TrendTile`, `StatTile`, `HeatmapTile`, `SearchTile`, `AlertsTile`, `MapTile`); `<BentoGrid>` with `children` renders your own selection inside the themed sheet.
- `ambient` (boolean, default true) stops the metric cycle, typing, switch flips, heatmap ticks and live-city pings when false, but keeps entrances and clicks. Reduced motion always forces it off. The alert switches and the trend chart also hold still while a pointer is over them.

**Tiles**
1. Trend: segmented control (Weekly actives / Signups / Revenue) with an ink pill on `layoutId` (spring 500/40); total in 34px display, a hairline delta chip, “14 days”. SVG line chart (640×220 viewBox, `preserveAspectRatio="none"`, non-scaling stroke), Catmull-Rom path, three dashed gridlines, an area fading from ink 14% to 0, and an accent “now” dot with a surface-coloured 3px border, placed in HTML by percentage.
2. Stat (inverted surface): “184ms”, number at `clamp(5.5rem, 4rem + 5vw, 8.5rem)`, tracking −0.06em; two meters: Northstar 0.18s against “The old warehouse” 9.6s.
3. Heatmap: 7 × 24 cells, 3px gaps, radius 3px, five ink strengths (6/16/34/60/100%); the peak (Tue 10:00) in the accent with a faint inset ink ring. Footer: peak label and a Less → More legend.
4. Search: 56px field (magnifier, typed text, blinking caret, ⌘K), then a 92px answer card (raised grey in dark, ink in light) with “Answer”, the answer in 19px display, the detail, and seven mini-bars, the last in the accent. Between answers: a dashed “Listening ···” state (never skeleton bars).
5. Alerts: a preview message from “Northstar · #growth” (ink square, surface-coloured north arrow) that shows while “Anomaly alerts” is on, otherwise a dashed “All quiet” line. Four 60px `role="switch"` rows; tracks are ink when on with a surface-coloured knob.
6. Map (deepest surface): title plus a live total (40px) with a pinging accent dot. A dot-matrix world sampled from rough lon/lat outlines every 2.5° (0.82 dots at 20% ink), accent city dots with expanding rings, and the top four cities.

**Typography**
- Display 600 for titles and figures, tracking −0.025 to −0.06em; mono 10–11px uppercase labels, tracking 0.06–0.16em; tabular numerals on every figure.

**Colour** (monochrome first, `theme` prop, dark default)
- Dark: page `#0a0a0a`, tiles `#101010`, ink `#f4f4f2`, rule `#222222`, stat tile inverted `#f4f4f2` with `#0a0a0a` ink, map `#060606`, field `#161616`, answer card `#1b1b1b`.
- Light: page `#f6f5f2`, tiles `#fbfaf8`, ink `#141412`, rule `#e2e1dd`, stat tile `#141412` with `#f6f5f2` ink, map `#141412`, field `#ffffff`, answer card `#141412`.
- `accent` prop, default `#d5f56a`, only on: the chart’s “now” dot, the peak cell, the live dot, cities and rings, the latest mini-bar. Everything else is ink at an opacity. Tiles re-point `--bn-ink` locally to invert or deepen, so one set of utilities serves every surface.

**Motion** (ease `[0.22, 1, 0.36, 1]`)
- One timeline per tile (seconds after the tile starts): the tile lands at 0 (opacity, 16px rise, no blur of its own so it never compounds) → label, title, body at 0.08/0.13/0.18 (12px rise out of an 8px blur) → figures at 0.24 (count up from zero over 0.9s with an 8px blur that clears) → data at 0.30 (the line and the world draw over 0.7s, cells wave in, bars grow) → progress at 0.62 (meters fill, the top-cities list staggers 50ms). Tiles in a row start 70ms apart; rows lower in the viewport start up to 220ms later.
- Trend: the line is revealed by widening a `clipPath` rect (pathLength breaks with non-scaling strokes); the dot springs in as the line arrives; metrics cycle every 4.2s while on screen until clicked (the first metric holds a full cycle after its line draws, and a pointer over the tile pauses and restarts the count), morphing `d` over 0.9s, and each new total re-counts from zero.
- Stat: the slow meter crawls 1.4s linear on purpose.
- Heatmap: 168 plain spans with CSS opacity/scale transitions delayed in a diagonal wave (12ms per step), then a random cell pops every 650ms.
- Map: the world sweeps in west to east through a clip rect; each city springs in as the sweep passes; rings start only after the sweep; counts tick every 1.1s and the list re-sorts with `layout`.
- Figures are motion values rendered as children, so counting never re-renders a tile. Loops run only while their tile is on screen.
- Staging: everything starts hidden in the server HTML. Tiles at least 25% on screen at mount play their entrance; tiles within 320px below the fold render finished; tiles further down render finished and replay once they approach. Deep links and full-page screenshots see finished tiles.
- Reduced motion: final states immediately, no loops, no typing, no counting.

**Accessibility**
- `section` labelled by the optional `h2` (or `aria-label`); tiles are `article`s with `h3`s.
- Metric buttons use `aria-pressed`; switches are buttons with `role="switch"` and `aria-checked`, 60px tall.
- The typing is `aria-hidden` with an sr-only list of every query and answer; heatmap and map are `role="img"` with labels; the alert preview is `aria-live="polite"`.
- Instant 2px focus outlines in ink on every control.

**Don’t**
- No marketing headline baked in, no tinted or lime-filled tiles, no second accent, no gradients, glows or glass.
- No skeleton bars, screenshots or images: every illustration is live markup.
- No per-frame React state for counting, and no loops off screen or under reduced motion.
