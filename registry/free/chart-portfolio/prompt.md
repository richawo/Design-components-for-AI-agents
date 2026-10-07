Build a financial-grade portfolio price chart in React + Tailwind CSS v4 (`motion/react` only for the range indicator). Hand-drawn SVG, no chart library. It should feel like the best brokerage apps: calm, exact, and alive under the cursor.

**Card**
- `#0b0b0c` surface, 1px `white/8%` border, 22px radius, inset top highlight `inset 0 1px 0 white/6%`, deep soft drop shadow.
- A blurred glow (`opacity .16`, `blur-3xl`) bleeds from the top edge in the trend colour: green `#34d399` when the range is up, rose `#fb7185` when down.

**Header**
- Left: a 28px rounded-square mark with the ticker's first two letters (mono, 10px, subtle white gradient fill), the asset name in white/80 at 14px, ticker and exchange in mono at white/35.
- Price: Geist, weight 500, `clamp(2rem, 1.6rem + 1.6vw, 2.75rem)`, tracking −0.04em, tabular numerals.
- Delta line: a triangle, the absolute change and the percentage in the trend colour, then the range caption ("Past month") in white/40.
- While hovering, the price and delta show the hovered point relative to the period's open, and the caption becomes the hovered timestamp.
- Right: a segmented control 1D / 1W / 1M / 3M / 1Y / All. Mono 11px, white pill indicator sliding with a spring (stiffness 500, damping 40). Full-width on mobile.

**Plot**
- Measure the container with ResizeObserver and draw at real pixel size. Height 320px (72% below 520px wide).
- Four hairline gridlines (`white/6%`) with compact currency labels right-aligned in a 56px gutter (no gutter on mobile).
- A dashed line at the period's opening price.
- Monotone cubic line (Fritsch–Carlson, never overshoots), 1.75px, in the trend colour, over a vertical gradient fill (28% → 4% → 0%).
- Volume bars along the bottom, 40px tall, `white/11%`. The bars under the cursor brighten to white/70.
- X-axis: 5 date labels (3 on mobile) in mono 10.5px white/35, with the first and last anchored to the edges.

**Interaction**
- The pointer (mouse and touch) picks the nearest sample. Draw a vertical crosshair at white/28, a dot with a dark centre and trend ring, and a blurred glow behind it.
- The line after the cursor fades to a 32% white "future" line, and the area after it disappears (clip paths).
- A small timestamp chip follows the cursor along the top, clamped inside the plot.
- Keyboard: the plot is focusable. Left/Right step through points (Shift jumps 10), Esc clears.
- Range change: resample every series to 140 points and morph between them with rAF over 650ms, ease-out quart. With reduced motion, swap instantly.
- At rest, the last point pulses (ping).

**Footer**
- A 4-up stat grid (2-up on mobile) separated by 1px gaps: Open, High, Low, Volume. Mono uppercase labels at white/35, values in white/85 with tabular numerals.

**Accessibility**
- The plot has `role="img"` with an aria-label summarising open and close, and the range control is a radiogroup.

**Don't**
- No chart library, no rainbow series, no 3D, no thick strokes.
- No tooltip box covering the line.
- No gradient on the price text.

**Feel**
- Scrubbing updates the headline price, delta and date instantly; a range change or leaving the chart counts every figure (price, delta, percentage and the four stats) to its new value over 450ms, so nothing snaps.
- The date pill above the crosshair rises 4px and fades in over 160ms.
- Range pills scale to 0.95 while pressed and carry a 2px focus ring.
