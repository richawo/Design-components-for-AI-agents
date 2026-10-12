# Workspace Shell

Build a restrained, reusable workspace frame that can hold a complete dashboard, report or settings page without imposing application data or a routing framework.

## Layout
The wide layout has a 188px navigation rail and a flexible main column. In containers narrower than 48rem the rail becomes a compact identity row with horizontal navigation. The main column has an editorial header, a spaced content area and an optional footnote.

## Visual language
Use a restrained monochrome palette with a deliberate typographic hierarchy, generous space around the page title and compact detail within each working panel. Keep the components' public prop contracts and their focus states. Secondary copy must remain readable in both themes. Use the display and mono font roles already supplied by the host. Avoid decorative gradients, repeated reassurance badges, invented status messages and uncontrolled movement.

## Behaviour
Pass real routes or unique section anchors through `links`. Navigation reflows from a sidebar to a horizontal strip based on the shell container. Place your page panels in `children` and host actions in `actions`. The shell owns presentation; each supplied panel keeps its interaction and data contract. Every visible control must have a real effect. Sample data belongs to the offline preview; host data and callbacks belong to the production export. Keep empty collections usable, preserve pending and failure states, and use stable identifiers across related panels.

## Motion and access
Use brief opacity and position entrances with reduced-motion alternatives. Avoid scaling text during size changes. Keep a clear heading order, visible focus, explicit button labels and keyboard paths through the page. Navigation must point at real routes or section anchors. Reflow to one column in narrow containers without clipping controls. The shell is a standalone component; supplied children own their own interactions.

## Retained workspace views
Also export WorkspacePanels, with activeId and panels ({ id, content }). Keep every supplied view mounted so unfinished drafts survive a switch. Measure the active view with ResizeObserver and animate the container height without scaling text. Fade inactive views out, make them inert and hidden from assistive technology immediately, then hide them visually after the exit. Unique panel IDs keep their state independent.

Header controls must stack above the page panels. Do not clip their menus at the shell edge; preserve the rounded identity rail with its own corner radii.

## Application navigation

For dashboards and workspaces, supply activeId and onNavigate. Render real tab buttons with roving focus, arrow/Home/End support, aria-selected and aria-controls pointing at unique host panel IDs. Use WorkspacePanels to retain unfinished drafts. A fixed-height shell keeps its navigation and header visible while only the current content pane scrolls. Without onNavigate, retain normal route and document-anchor links.

WorkspacePanels also accepts fill for fixed-height applications. In that mode it fills the content pane, retains independent scroll positions and fades views without resizing the surrounding application.
