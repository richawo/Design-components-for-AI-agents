Build a live bento grid feature section in React + Tailwind CSS (v4) + `motion/react` for a fictional analytics product, “Northstar”. Six tiles, each with a small working illustration drawn in markup. It should read like a Swiss product poster, not a SaaS template.

**Layout**
- Section on warm neutral `#f6f5f2`, ink `#141412`. Container max-w 80rem, padding 20/32/48px, vertical 64/80/112px.
- Header: 12-col grid. Left 7 cols: mono eyebrow with a 6px ink dot, then the heading. Right 5 cols, bottom-aligned: intro paragraph (max 46ch) and an underlined link with an arrow that nudges 4px on hover.
- The grid is one sheet of hairlines: `gap-px` on a container whose background is ink at 9%, a 1px border in the same colour, radius 22px, overflow hidden. Tiles are `#fbfaf8` with no radius and no shadow, so the gaps read as 1px rules.
- Columns: 1 → 2 at md → 6 at lg. Spans at lg: Trend 4 + Stat 2, Heatmap 3 + Search 3, Alerts 2 + Map 4, so the rows step 4/2, 3/3, 2/4. At md: Trend and Map span 2; the rest are 1 each.
- Every tile: padding 24/32px; mono label (“01 / Trends”), display title 22–24px, body 15px/1.55 at 68% ink with `text-wrap: pretty`; the illustration is pushed to the bottom with `mt-auto` so tiles in a row share a baseline.

**Tiles**
1. Trend (light): a segmented control (Weekly actives / Signups / Revenue) with a sliding ink pill (`layoutId`); total in 34px display plus a delta chip (ink chip, lime text). The SVG line chart (640×220 viewBox, `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`) uses a Catmull-Rom smoothed path, three dashed gridlines, an area fill fading from ink 12% to 0, and a lime end-dot with a 3px ink ring placed in HTML by percentage so it never distorts. Mono date labels sit underneath.
2. Stat (accent `#d5f56a`, ink text): “184ms” with the number at `clamp(5.5rem, 4rem + 5vw, 8.5rem)`, tracking −0.06em, and the unit at about a third of that size. Under a 15% rule, two comparison bars: Northstar 0.18s against “The old warehouse” 9.6s.
3. Heatmap (light): 7 rows (Mo–Su) × 24 hours, 3px gaps, square cells at radius 3px, five ink opacities (5/16/34/60/100%). The peak cell (Tue 10:00) is lime with a 2px inset ink ring. Footer: the peak label, plus a Less → More legend.
4. Search (light): a 56px white input with a magnifier, typed text, a blinking caret and a ⌘K key. Below it, a 92px answer card in ink: a lime “Answer” label, the answer in 19px display, the detail at 60%, and seven mini bars with the last one lime.
5. Alerts (light): a 96px preview message from “Northstar · #growth” (an ink square with a lime north arrow) that shows while “Anomaly alerts” is on and turns into a dashed “All quiet” placeholder when it’s off. Under it, a white card of four 60px rows; each row is one `role="switch"` button with label, mono detail and a 38×22 track (ink when on, lime knob).
6. Map (dark `#141412`): a title block plus a live total (40px display) with a pinging lime dot. The dot-matrix world comes from rough continent outlines (lon/lat polygons) sampled every 2.5° with point-in-polygon tests: 0.82-radius dots at 20% cream. Cities are lime dots with expanding rings. Footer: the top four cities in a 2/4-col list with mono lime counts.

**Typography**
- Heading: display 600, `clamp(2.5rem, 1.4rem + 4.6vw, 5.25rem)`, leading 0.95, tracking −0.045em; the closing clause sits in the same font at 40% opacity (two tones, no italic).
- Labels: mono 10–11px uppercase, tracking 0.06–0.16em. All figures use tabular numerals.

**Colour**
- Paper `#f6f5f2`, tiles `#fbfaf8`, ink `#141412` (rules at 9–15%, body at 68–75%), one accent `#d5f56a`, used only on the stat tile, live dots, the peak cell, knobs and deltas.

**Motion** (ease `[0.2, 0.8, 0.2, 1]`)
- The chart draws by widening a `clipPath` rect over 1.6s. Don’t use `pathLength`, which breaks with non-scaling strokes. Metrics then morph by animating `d` (0.9s) every 4.2s until the user clicks one.
- The stat counts 0 → 184 over 1.6s; the bars grow 0.4s and 2.4s (linear: the slow one should feel slow).
- Heatmap cells stagger in (25ms per hour, 40ms per day), then a random cell pops every 650ms.
- Search types at 38–88ms per character, holds the answer for 2.6s, deletes three characters at a time, then moves to the next query.
- Switches flip every 1.7s in a scripted order until the user touches one; the knob uses a spring (600/34).
- Map rings expand r 1.6 → 7 and fade over 2.4s, staggered; a random city pops and its count ticks every 1.1s; the top-four list re-sorts with `layout`.
- Entrances only play for tiles the viewer will watch arrive: tiles at least 30% on screen at mount, or tiles that come within 320px of the viewport later. Anything else (deep links, full-page screenshots) renders the finished state.
- Reduced motion: final states, no loops, no counting, no typing.

**Accessibility**
- A section with `aria-labelledby`; one `h2`, and each tile an `article` with an `h3`.
- The metric buttons use `aria-pressed`; switches are real buttons with `role="switch"` and `aria-checked`, with rows at least 60px tall.
- The decorative typing is `aria-hidden`, with an sr-only list of every query and answer. The heatmap and map carry `role="img"` with descriptive labels, and the alert preview is `aria-live="polite"`.
- Visible focus rings in ink on every control.

**Don’t**
- No three identical icon cards, gradients, glows, glass or drop shadows on tiles. Hairlines only.
- No screenshots or images. Every illustration is live markup.
- Don’t use more than one accent colour, and don’t let every tile animate on a loop when reduced motion is on.
