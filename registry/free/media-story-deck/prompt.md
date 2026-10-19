# Editorial Story Deck

Build a standalone React 19 and Tailwind v4 component with the existing named export, props type and overridable default demo.

## Layout and type

Pair a geometric study with a compact editorial story. Stack art above copy in a narrow container and place the previous/next controls below both. Keep orbit, grid and steps artwork original and neutral. Use 36px Instrument Serif story headings, 14px body copy and 12px metadata, with a large display figure supplied as text.

## Interaction and data

Keep the public StoryDeckProps and StorySlide types. Every slide supplies an id, kicker, title, description, figure, caption and orbit/grid/steps pattern. IDs are stable and unique.

Selection is local. Floor finite defaultIndex values and clamp them to the current collection; non-finite values choose the first slide. Replacing or shrinking slides retains a valid displayed index.

Previous and next are labelled native buttons with 44px targets. Disable unavailable directions. onSlideChange reports a zero-based index synchronously after explicit navigation; the host owns persistence.

Expose a named carousel and slide position, plus a polite position counter. Empty slides show a written empty state and disable both controls. Preserve long content without horizontal document overflow.

## Motion

Each keyed story arrives with opacity and an 8px rise over 320ms. Controls remain outside the changing story. Use the existing 150ms press response. Navigation is manual, with no autoplay or ambient loops. Listen to live preference changes. Stop and settle the current story immediately while preserving the controls and focus; subsequent reduced-motion stories enter without travel.

## Integration

Pass stable unique slide IDs. defaultIndex is an initial local selection, floored and clamped to the available stories. Handle onSlideChange as a synchronous notification and persist the index outside the component if needed.

Keep all source in one self-contained file with allowed imports. Use the source palettes and font roles, real content, visible focus, written empty states and 320/390/768/1024/1440/1920px container layouts.
