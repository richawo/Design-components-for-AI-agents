// The branded demo cursor, shared by the live player (components/site/demo-player.tsx)
// and the recorder (scripts/record-demos.mjs), so the card video and the live
// page show the same pointer. A white arrow with a dark hairline edge and a
// soft shadow; a press ring in the site accent appears only on click.

export const CURSOR_ACCENT = "#ff7a45";

/** Arrow tip sits at (3, 2) in a 24×24 box; the wrapper offsets by that so the tip is the hotspot. */
export const CURSOR_HOTSPOT = Object.freeze([3, 2]);
export const CURSOR_SIZE = 24;

export const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 2v16.7l4.5-4.1 2.85 6.35 2.75-1.22-2.8-6.27h6.1z" fill="#fff" stroke="rgba(10,10,12,0.82)" stroke-width="1.15" stroke-linejoin="round"/></svg>`;

/** Starting point of every demo, as a fraction of the viewport: low and to the right, out of the way. */
export const CURSOR_START = Object.freeze([0.74, 0.82]);

/**
 * Inline styles for the cursor and its press ring. Kept as strings so the
 * recorder can inject the same look into a page with no React.
 */
export const CURSOR_CSS = `
.dfa-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:${CURSOR_SIZE}px;height:${CURSOR_SIZE}px;margin:-${CURSOR_HOTSPOT[1]}px 0 0 -${CURSOR_HOTSPOT[0]}px;opacity:0;transition:opacity 180ms cubic-bezier(0.22,1,0.36,1);will-change:transform;contain:layout style}
.dfa-cursor[data-on="1"]{opacity:1}
.dfa-cursor__arrow{display:block;transform-origin:${CURSOR_HOTSPOT[0]}px ${CURSOR_HOTSPOT[1]}px;transition:transform 90ms cubic-bezier(0.22,1,0.36,1);filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35)) drop-shadow(0 3px 8px rgba(0,0,0,0.28))}
.dfa-cursor[data-down="1"] .dfa-cursor__arrow{transform:scale(0.9)}
.dfa-cursor__ring{position:absolute;left:${CURSOR_HOTSPOT[0] - 14}px;top:${CURSOR_HOTSPOT[1] - 14}px;width:28px;height:28px;border-radius:50%;border:2px solid ${CURSOR_ACCENT};box-shadow:0 0 12px ${CURSOR_ACCENT}66;opacity:0;transform:scale(0.35)}
.dfa-cursor__ring[data-pulse="1"]{animation:dfa-cursor-ring 460ms cubic-bezier(0.22,1,0.36,1) forwards}
@keyframes dfa-cursor-ring{0%{opacity:0.95;transform:scale(0.35)}100%{opacity:0;transform:scale(1.25)}}
`;

/** The cursor's DOM, as HTML. */
export const CURSOR_HTML = `<span class="dfa-cursor__ring"></span><span class="dfa-cursor__arrow">${CURSOR_SVG}</span>`;
