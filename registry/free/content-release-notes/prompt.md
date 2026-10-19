# Editorial Release Notes

Build a self-contained React 19, Tailwind CSS v4 and motion/react component. Lead with a readable release timeline, aligned version/date markers and feature/fix details. Keep the title and filters compact relative to the release content. Fit the three filters on one phone row, and use a top-aligned 1120px demo stage to retain the complete default reader.

Use neutral graphite and white chrome, readable 14-16px body copy, 12px mono metadata and 44px native control targets. Keep the complete working object responsive at 320, 390, 768, 1024, 1440 and 1920px in both themes.

- Pass releases in the intended display order with stable IDs, ISO date strings and feature/fix changes. The component preserves the supplied order.
- Everything, Features and Fixes are native pressed buttons. Filtering changes the visible entries and their change lists; empty matches have written feedback.
- initialCount is a finite initial limit, rounded down and clamped to one; non-finite limits fall back to two. The local older-releases disclosure applies within the current filter.
- Keep publishing and routing in the host. This reader does not save a release or invent a remote action. Reduced motion settles article movement without replacing the filter controls.

Use a brief entrance and interruptible state motion. Respect reduced motion at first paint and when changed while mounted, retaining control focus, selected text and current data. Keep text selection high-contrast within the reader in both themes. Keep data-demo targets stable, the default demo complete and offline, and preview controls tied to visible props. Avoid remote assets, invented network actions, decorative status badges and repeated marketing headers.
