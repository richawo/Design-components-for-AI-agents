# Workspace Shell

Build a container-responsive application frame: a navigation rail with a travelling selection, a compact page header with actions, a scrolling content pane and an optional footer, plus WorkspacePanels, which keeps every view mounted so drafts survive switching. Stack: React 19, Tailwind CSS v4, motion/react.

## Layout

- **frame:** Radius 20px, hairline border, soft deep shadow with an inset top highlight; it never clips, so header menus can escape it.
- **rail:** 212px from the 48rem container breakpoint, a surface-to-background gradient, brand mark (32px, inset highlight) and name, optional mono navLabel, links (40px tall, optional 16px icon and mono badge) and an optional railFooter pinned to the bottom.
- **compact:** Below 48rem the rail becomes a brand row and a horizontally scrolling tab strip with a 2px underline.
- **header:** Mono eyebrow, title and subtitle on the left, actions on the right (items-end), 20–24px vertical padding, raised above the content (z-20).
- **content:** Flexible pane that scrolls on its own inside a fixed-height shell; 16–28px padding.

## Typography

- **title:** Display 500, clamp(1.375rem, 2.2cqi, 1.75rem), leading 1.15, tracking −0.035em.
- **subtitle:** 14px, leading 1.6, max 78ch.
- **links:** 14px 500, tracking −0.01em.
- **metadata:** Mono 11–12px uppercase, tracking 0.14em.

## Colour

- **dark:**
  - **bg:** #09090a
  - **surface:** #0f0f11
  - **raised:** #161618
  - **wash:** #1b1b1e
  - **line:** #242427
  - **ink:** #f4f4f5
  - **muted:** #a1a1aa
- **light:**
  - **bg:** #f7f7f6
  - **surface:** #ffffff
  - **raised:** #fbfbfa
  - **wash:** #efeff0
  - **line:** #e1e1e4
  - **ink:** #171719
  - **muted:** #55555e
- **accent:** One accent for the selection mark; defaults to ink. Every colour is exposed to children as --ws-* tokens.

## Motion

- **selection:** A raised pill with a 2px accent bar (rail) or a 2px underline (strip) travels between links with layoutId on spring 500/40.
- **header:** Eyebrow, title and subtitle rise 8px from a 6px blur, 50ms apart, 0.42s ease-out; a changed title re-enters keyed.
- **panels:** WorkspacePanels measures the active view and animates container height (0.24s) without scaling text; outgoing views become inert and aria-hidden immediately, fade 0.2s with a 6px drop, then hide.
- **reduced motion:** Instant selection, 120ms fades, no transforms.

## Responsive

Container queries on @container/ws; the shell works in a sidebar column or full width, from 320px up.

## Accessibility

- With onNavigate, links render as role=tab buttons in a tablist with roving tabindex, arrows, Home and End, aria-selected and aria-controls from #id hrefs.
- Without onNavigate, links stay anchors with aria-current=location.
- If a content action retires the focused panel, focus moves to the visible tab; focus the host moved elsewhere is never reclaimed.
- Visible 2px focus rings; 44px touch targets in the compact strip.

## Content

- brand, eyebrow, title, subtitle, links[{ id, label, href, icon?, badge? }], activeId, onNavigate.
- actions, children, footer, railFooter, navLabel, accent, theme, className, contentClassName.
- WorkspacePanels: activeId, panels[{ id, content }], fill, className.

## Don't

- An editorial headline in the header; it is tool chrome.
- Tinted surfaces or coloured navigation; colour is the one accent.
- overflow: hidden on the frame (it clips menus).
- Unmounting inactive views (drafts are lost).
