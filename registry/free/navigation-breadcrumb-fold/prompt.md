# Breadcrumb Fold

Build a self-contained React 19, Tailwind v4 and motion/react component with the existing typed API, named export and overridable default demo.

## Layout and type

A compact breadcrumb rail with a quiet folder mark, real ancestor links and a plain current-page label. Long paths fold middle ancestors behind a 44px ellipsis control; expanding reveals the complete path with a separate collapse action. Keep neutral graphite surfaces, restrained depth, clear chevrons, readable wrapping and visible focus. Wrapped ancestor links retain 8px vertical inner padding.

## Interaction

Preserve BreadcrumbItem, BreadcrumbFoldProps and the named BreadcrumbFold export. Use real native ancestor links; mark the final plain label with aria-current=page instead of linking it.

For paths longer than three items, retain the first and final two locations when folded. The ellipsis button names its action, exposes expanded state and identifies the path list. Hidden ancestors are absent from keyboard navigation.

Use Enter/Space activation for expand/collapse. Move focus before paint to the corresponding replacement control; if focused path controls disappear when the host shortens the path, retain context at the outlined navigation landmark.

Keep focus attached to retained ancestors through position changes with stable href and occurrence keys. Do not take focus back after the user has left the path.

Use instance-scoped list IDs, labelled navigation and written empty content. Handle zero, one, short, long and repeated-href paths plus independent instances without overflow.

The host supplies real destinations and owns route changes. Expanding or folding only changes the path presentation.

## Motion

Enter the breadcrumb rail with opacity and an 8px rise over 320ms. Keep 150ms link/button feedback and immediate focus handoff during folding. The path can wrap within its own width. Subscribe to live prefers-reduced-motion changes and stop and settle the owned entrance immediately. Remove press transforms.

## Integration

Supply ordered real destinations; the final entry is the current location and renders as text. Use distinct navigation labels for multiple paths. Stable href identities preserve retained-link focus, and folding keeps keyboard context within the navigation without changing the route.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.
