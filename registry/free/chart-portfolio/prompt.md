Build a financial-grade portfolio price chart in React + Tailwind CSS v4 + `motion/react`. Hand-drawn SVG, no chart library, monochrome except for the data, dark by default with a `theme` prop for a light card. It should feel like the best brokerage apps: calm, exact, and alive under the cursor.

**Card**
- Root is `@container`. Tokens per theme in one object, written to `--cp-*` variables. Dark: surface `#0b0b0c`, ink `#ffffff`, up `#34d399`, down `#fb7185`. Light: surface `#ffffff`, ink `#0b0b0c`, up `#059669`, down `#e11d48`.
- 1px ink/8% border, 22px radius, inset top highlight and a deep soft drop shadow (light: a soft 0 24px 60px shadow). No glow: green and red only ever mark the data (line, area, change, dots).

**Header**
- Left: a 28px rounded-square mark with the ticker's first two letters (mono, 10px, ink/6% fill), the asset name in ink/80 at 14px, ticker and exchange in mono at ink/40.
- Price: Geist, weight 500, `clamp(2rem, 1.6rem + 1.6vw, 2.75rem)`, tracking −0.04em, tabular numerals.
- Delta line: a triangle, the absolute change and the percentage in the trend colour, then the range caption ("Past month") in ink/45.
- While hovering, the price and delta show the hovered point relative to the period's open, and the caption becomes the hovered timestamp.
- Right: a segmented control 1D / 1W / 1M / 3M / 1Y / All. Mono 11px, ink pill indicator (surface-coloured label) sliding with a spring (stiffness 500, damping 40). Full-width on mobile.

**Plot**
- Measure the container with ResizeObserver and draw at real pixel size. Height 320px (72% below 520px wide).
- Four hairline gridlines (ink/6%) with compact currency labels right-aligned in a 56px gutter (no gutter on mobile).
- A dashed line at the period's opening price.
- Monotone cubic line (Fritsch–Carlson, never overshoots), 1.75px, in the trend colour, over a vertical gradient fill in the same colour (20% → 3% → 0%).
- Volume bars along the bottom, 40px tall, ink/11%, drawn as one path. The bars under the cursor brighten to ink/70.
- X-axis: 5 date labels (3 on mobile) in mono 10.5px ink/40, with the first and last anchored to the edges.

**Interaction**
- The pointer (mouse and touch) picks the nearest sample. Draw a vertical crosshair at ink/28, a dot with a surface-coloured centre and a trend ring, over an 18% trend halo.
- The line after the cursor fades to a 32% ink "future" line, and the area after it disappears (clip paths).
- A small timestamp chip follows the cursor along the top, clamped inside the plot.
- Keyboard: the plot is focusable. Left/Right step through points (Shift jumps 10), Esc clears.
- Entrance (once, at 35% in view; the server HTML starts hidden so nothing flashes). The card lands first (opacity + 16px rise, no blur, 0.6s, ease `[0.22, 1, 0.36, 1]`). Then, in seconds: identity row 0.06, price 0.12, change line 0.18 and range control 0.14, each a 12px rise out of an 8px blur; gridlines and axis labels at 0.20; the line rises from the plot floor in a left-to-right wave from 0.24 over 1.0s (each point's progress = clamp(t·1.6 − i/n·0.6), ease-out cubic), invisible until it starts moving, with the volume bars growing alongside and the area fading in; the four stat cells rise from 0.42 at 60ms steps. Every figure counts up from zero over 0.9s while an 8px blur clears. The live dot springs in as the wave lands.
- Drive it with motion values: an `intro` value (0→1) and a `morph` value feed `useTransform`, which builds the line, area and volume path strings bound to `motion.path d`. Counting figures are motion values rendered as text. No per-frame React state.
- Range change: resample every series to 140 points and morph the values and the price domain together over 650ms, ease-out quart, starting from wherever a previous morph had got to. With reduced motion, swap instantly.
- Reduced motion: 150ms fades only; the line, the figures and the stats are final at once; no ping.
- At rest, the last point pings (the one ambient signal).

**Footer**
- A 4-up stat grid (2-up on mobile) separated by 1px gaps: Open, High, Low, Volume. Mono uppercase labels at ink/40, values in ink/85 with tabular numerals.

**Accessibility**
- The plot has `role="img"` with an aria-label summarising open and close, and the range control is a radiogroup.

**Don't**
- No chart library, no rainbow series, no 3D, no thick strokes, no trend-tinted glow behind the card.
- No per-frame React state for the entrance or the morph.
- No tooltip box covering the line.
- No gradient on the price text.

**Feel**
- Scrubbing updates the headline price, delta and date instantly; a range change or leaving the chart counts every figure (price, delta, percentage and the four stats) to its new value over 450ms, so nothing snaps.
- The date pill above the crosshair rises 4px and fades in over 160ms.
- Range pills scale to 0.95 while pressed and carry a 2px focus ring.
