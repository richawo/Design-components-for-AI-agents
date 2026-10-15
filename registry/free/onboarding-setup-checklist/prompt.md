# Workspace Setup Checklist

Build a standalone React 19 and Tailwind v4 component. An actionable setup checklist with a drawn completion ring, expandable instructions and native checkboxes, designed for thoughtful first-run experiences.

## Layout

A 64px progress ring alongside a serif heading, followed by broad checklist rows, each led by an 18px ink checkbox whose check draws in, inside a 44px target. Each task has a short time estimate and inline instructions. Size to the container. Use a 4/8px rhythm, 1px surface edges, 16px narrow padding and 24px desktop padding. Controls have 44px targets.

## Typography and colour

Use font-sans at 14-16px/1.5, font-mono metadata at 11-12px and a 24-36px heading with -0.035em tracking. Dark uses #111111, #f5f5f5, #a3a3a3 and #333333; light uses #ffffff, #171717, #525252 and #d4d4d4. Maintain AA contrast.

## Motion

Use a 320ms opacity/8px entrance, 150ms press response and 240ms state changes, easing cubic-bezier(0.22,1,0.36,1). No ambient loops. Reduced motion removes transforms and layout animation and limits fades to 120ms.

## Behaviour and accessibility

Use semantic elements, native keyboard behaviour, visible focus rings and instance-scoped IDs. Expose typed content and callbacks. Handle empty custom data and repeated instances. Announce important feedback politely. Match the source state ownership and callback contract.

## Responsive

Design for 320, 390, 768, 1024, 1440 and 1920px. Respond to the container with @container variants, wrap text and stack secondary details. Scroll only within explicitly labelled local regions.

## Avoid

No remote imagery, false success states, unlabelled controls, hover-only actions, low contrast or decorative status pills. The demo is an isolated component on a quiet stage.
