# Windowed Pagination

Build a standalone React 19 and Tailwind v4 component. A compact pagination rail with first and last anchors, moving selection and a live page count that stays usable in narrow result panels.

## Layout

A results label and mono page count sit above a centred window of page buttons. Previous and Next controls sit on a separate row below. The selected neutral surface travels between numbers without inverting text contrast. Keep seven 44px slots when the rail has at least 320px, and five slots below that width. Show all pages for small totals; otherwise retain first and last anchors, predictable ellipses and a centred neighbourhood. The rail stays one row and 44px tall. Size to the container. Use a 4/8px rhythm, 1px surface edges, 16px narrow padding and 24px desktop padding. Controls have 44px targets.

## Typography and colour

Use font-sans at 14-16px/1.5, font-mono metadata at 11-12px and a 24-36px heading with -0.035em tracking. Dark uses #111111, #f5f5f5, #a3a3a3 and #333333; light uses #ffffff, #171717, #525252 and #d4d4d4. Maintain AA contrast.

## Motion

Use a 280ms opacity/8px entrance. Key each slot by its page number or stable ellipsis identity, animate retained positions over 260ms and fade entering or exiting numbers over 120ms with a 4px directional offset. Pop exits out of flow so the rail never grows or jumps. Glide the selected surface over 280ms and cross-fade the page caption over 180ms, easing cubic-bezier(0.22,1,0.36,1). No ambient loops. Reduced motion removes transforms and layout animation and limits fades to 120ms.

## Behaviour and accessibility

Use semantic elements, native keyboard behaviour, visible focus rings and instance-scoped IDs. Expose typed content and callbacks. Handle empty custom data and repeated instances. Announce important feedback politely. Only update local selection when uncontrolled; a controlled click calls onPageChange and waits for the host. Clamp selection when pageCount shrinks. Keep keyboard focus on a clicked number during window movement, and move it to the clamped selection if a host update removes the focused page. Exiting slots become inert and aria-hidden immediately. Use one live status announcement, with the animated visual caption hidden from assistive technology. Compact very large visible page labels while keeping full accessible names.

## Responsive

Design for 320, 390, 768, 1024, 1440 and 1920px. Measure the rail with ResizeObserver to choose five or seven stable slots. Wrap the header only when needed; retain 44px targets and a single page row. Scroll only within explicitly labelled local regions.

## Avoid

No remote imagery, false success states, unlabelled controls, hover-only actions, low contrast or decorative status pills. The demo is an isolated component on a quiet stage.
