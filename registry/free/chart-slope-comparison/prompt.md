# Period Slope Comparison

Build a self-contained React 19, Tailwind CSS v4 and motion/react component. Lead with two large endpoint values and a shared slope plot. Keep inactive series as quiet dashed context, with explicit labels and native highlighted-series controls below.

Use neutral graphite and white chrome, readable 14-16px body copy, 12px mono metadata and 44px native control targets. Keep the complete working object responsive at 320, 390, 768, 1024, 1440 and 1920px in both themes.

- Supply series with stable unique IDs and numeric before/after values. beforeLabel, afterLabel and unit label the actual observations.
- The selected series stays local. onSelect reports a copied series object for observation; it does not persist or control selection.
- Non-finite displayed values become zero. A finite endpoint range that overflows subtraction has a written unplottable state instead of invalid SVG geometry.
- An empty collection retains the period labels and written empty state. Preset buttons support native Enter/Space activation, while the accessible chart label follows the active series.

Use a brief entrance and interruptible state motion. Respect reduced motion at first paint and when changed while mounted, retaining control focus and current data. Keep data-demo targets stable, the default demo complete and offline, and preview controls tied to visible props. Avoid remote assets, invented network actions, decorative status badges and repeated marketing headers.

Animate changing figures over 280ms and stop them immediately when reduced motion changes. Very large differences settle directly so numeric animation cannot overflow. Keep selection callbacks independent of the host’s series array.
