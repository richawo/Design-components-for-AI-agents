# JSON Response Inspector

Build a standalone React 19 and Tailwind v4 component with the existing named export, props type and overridable default demo.

## Layout and type

Build a focused data reader with a 16px heading, braces icon, indentation guides and 13px mono JSON content. Use 44px disclosure buttons. Let long values wrap and oversized nested documents scroll only inside the labelled, keyboard-focusable JSON region. Keep the demo aligned at the top as its document folds.

## Interaction and data

Keep InspectValue and JsonInspectorProps. Render null, primitive values, empty arrays and empty objects truthfully. Escape keys and values as text.

Track folded branches by their full logical key path, independently of traversal position. Reordering object keys must retain the same collapsed branches and focus. Keep the numbered data-demo paths for the existing default replay.

Scope disclosure IDs to each component instance and encode logical paths into valid IDs. Each aria-controls target exists, and each native button exposes its current expanded state.

Clamp finite maxDepth to 1-24; non-finite values use 12. Render at most 100 children per branch and 500 entries in total. Detect cycles per ancestor chain, so shared acyclic values remain visible.

Collapsed descendants release the render budget. Explain the display limit and let users collapse earlier branches to reveal later entries. This is a reader with local disclosure state, without an editing or save contract.

## Motion

The reader enters with opacity and an 8px rise over 320ms. Disclosure chevrons turn over 150ms. Keep JSON disclosure semantics and branch focus immediate. Listen to live preference changes and immediately finish the reader entry. Remove chevron travel transitions without remounting the document.

## Integration

Pass JSON-like data and a useful root label. Use maxDepth to bound nesting. Fold state follows logical object-key paths when data refreshes. The viewer bounds rendered entries and provides a labelled scroll region; it does not edit or persist the payload.

Keep all source in one self-contained file with allowed imports. Use the source palettes and font roles, real content, visible focus, written empty states and 320/390/768/1024/1440/1920px container layouts.
