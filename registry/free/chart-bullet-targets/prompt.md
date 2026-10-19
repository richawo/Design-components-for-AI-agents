# Bullet Target Comparison

Build a self-contained React 19, Tailwind CSS v4 and motion/react component. Lead with three clean actual bars and thin target markers. Align visible values and target/scale labels, with reporting-period controls beside the compact title.

Use neutral graphite and white chrome, readable 14-16px body copy, 12px mono metadata and 44px native control targets. Keep the complete working object responsive at 320, 390, 768, 1024, 1440 and 1920px in both themes.

- Pass reporting periods in display order with stable unique IDs and their metrics. defaultPeriod selects an initial ID, falling back to the first period.
- Every metric has an actual, target, ceiling and unit. Negative or non-finite numbers display as zero; the scale expands to include the result and target.
- onPeriodChange reports the chosen ID synchronously. The component keeps local selection, and the host owns persistence and any asynchronous work.
- Empty periods and periods without metrics have written empty states. Accessible chart labels include the actual, target, unit and full scale.

Use a brief entrance and interruptible state motion. Respect reduced motion at first paint and when changed while mounted, retaining control focus and current data. Keep data-demo targets stable, the default demo complete and offline, and preview controls tied to visible props. Avoid remote assets, invented network actions, decorative status badges and repeated marketing headers.

Show the actual figures on the first render, then animate later value changes over 280ms and stop them immediately when reduced motion changes. Very large differences settle directly so numeric animation cannot overflow. Wrap long unit labels and allow the value to take its own line at 320px.
