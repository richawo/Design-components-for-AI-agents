# Empty Search

Build a self-contained React 19, Tailwind v4 and motion/react component with the existing typed API, named export and overridable default demo.

## Layout and type

A focused empty-search panel with two offset document sheets, a fine search icon, a 36px Instrument Serif heading, the actual failed phrase and a compact list of alternative topics. Keep neutral graphite surfaces, 14px guidance, clear separators and separate 44px topic/clear actions. Give wrapped topic text at least 8px vertical inner space. Wrap long phrases and labels and keep arrow icons from shrinking.

## Interaction

Preserve EmptySearchProps, SearchSuggestion and the named EmptySearch export. Display query remains owned by the host; callbacks do not optimistically replace it.

Use native topic and clear buttons with Enter/Space activation, 44px targets and visible focus. Send exactly the selected query, or call onClear once. Disable actions that have no corresponding handler.

Keep focus attached to a topic through host reordering, using stable query and occurrence keys rather than list positions. Render repeated supplied queries without duplicate React keys.

Announce the current query or blank-query starting message through a polite status. A refused host proposal retains the actual prior query. Empty and arriving suggestions remain readable without invented results.

Accept long headings, queries and labels, empty arrays and independent instances with separate heading IDs. Wrap text without document overflow; keep the arrow visible.

The component proposes queries and clearing synchronously. The host owns search execution, navigation, loading, persistence and error handling.

## Motion

Enter the panel once with opacity and an 8px rise over 320ms. Keep 150ms button press feedback. Query changes update the actual written status without a fabricated result list. Subscribe to live prefers-reduced-motion changes, stop and settle the owned entrance immediately and remove press transforms.

## Integration

Supply the actual query and suggested label/query pairs. onSearch and onClear are synchronous requests; update query when the host accepts them and implement search/navigation in the host. Missing handlers disable their actions.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.
