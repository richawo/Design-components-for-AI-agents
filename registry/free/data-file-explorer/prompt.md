# Project File Explorer

Build a self-contained React 19, Tailwind v4 and motion/react file navigator with the existing named export and overridable default demo.

## Layout and type

Keep the project hierarchy and selected-file reader side by side in wide containers and stack them on phones. Use a compact 14px mono project heading, 13px mono filenames, a 16px selected-file heading and 14px descriptive copy. Preserve neutral hairlines and surfaces. Give the navigation pane a 480px height cap and local scrolling, with 192px minimum node widths so deep folders stay reachable without scrolling the project card sideways.

## Interaction and data

Keep ExplorerNode and FileExplorerProps. Nodes provide stable globally unique IDs, names, file/folder kinds, optional children and optional detail. Preserve the existing 24-level guard for malformed nesting.

Use native folder buttons with aria-expanded and linked lists. Closed descendants leave keyboard and accessibility navigation immediately. Keep the file visible in the reader when its containing folder closes.

Key siblings by logical IDs so host reordering keeps the focused file. Keep disclosure IDs scoped to each component instance and let long names retain their complete accessible labels.

SelectedId controls the reader; defaultSelectedId initializes local selection. Controlled file actions without onSelect are disabled, while folder disclosure stays available. Host replacement that removes the selected file returns the reader to Select a file.

onSelect receives an independent deep copy synchronously. The host owns asynchronous loading, navigation and persistence. Do not add a fabricated save receipt or retry contract.

Keep the navigation keyboard-focusable and independently scrollable. Deep file focus and long collections must keep the project heading fixed horizontally. Empty projects, empty folders and nesting limits have written states.

Name the selected-file region from its heading. Support long descriptions, opaque IDs and independent project instances with no duplicate DOM IDs.

## Motion

Keep the project navigation stable. Each keyed file reader arrives with opacity and a 4px rise over 240ms. Folder chevrons rotate over 150ms; folder disclosure semantics remain immediate. Use the existing hover, press and visible-focus treatments. Listen to live preference changes and stop and settle the current reader immediately without replacing the focused file button. Disable chevron transitions under reduced motion.

## Integration

Supply a hierarchy with stable globally unique IDs. Use defaultSelectedId for local selection, or selectedId with onSelect for host control. onSelect is a synchronous notification with an independent deep copy; the host owns loading and persistence. Keep large and deep trees inside the local navigation scroll region.

Use the source dark/light palettes, 44px controls, visible keyboard focus and 320/390/768/1024/1440/1920px container layouts. Do not imply local filesystem access; the host provides the records.
