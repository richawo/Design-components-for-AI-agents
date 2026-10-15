# Communication Preferences

Build a standalone React 19 and Tailwind v4 component. A calm preference form with explicit required updates, generous checkbox rows and an awaited save action that keeps failures visible for retry.

## Layout

A serif invitation over ruled preference rows. The copy takes the width, and an 18px checkbox (ink fill, check that draws in, 40% when locked) sits at the edge in a 44px target. Use a fixed action column beside an intrinsically sized feedback cell; below 420px, stack feedback above the right-aligned action. Invisible, aria-hidden copies of the actual saved/error messages reserve their naturally wrapped height, and an intrinsic label stack keeps Save and Saving the same width. Do not guess a feedback min-height or reflow the action on save. Size to the container. Use a 4/8px rhythm, 1px surface edges, 16px narrow padding and 24px desktop padding. Controls have 44px targets.

## Typography and colour

Use font-sans at 14-16px/1.5, font-mono metadata at 11-12px and a 24-36px heading with -0.035em tracking. Dark uses #111111, #f5f5f5, #a3a3a3 and #333333; light uses #ffffff, #171717, #525252 and #d4d4d4. Maintain AA contrast.

## Motion

Use a 320ms opacity/8px entrance, 150ms press response and 240ms state changes, easing cubic-bezier(0.22,1,0.36,1). No ambient loops. Reduced motion removes transforms and layout animation and limits fades to 120ms.

## Behaviour and accessibility

Use semantic elements, native keyboard behaviour, visible focus rings and instance-scoped IDs. Keep the native save button focused while pending with aria-busy/aria-disabled and a synchronous duplicate-request guard; only the missing-handler state is natively disabled. A rejected save keeps the same focused retry target. Expose typed content and callbacks. Handle empty custom data and repeated instances. Announce only the real feedback politely, excluding intrinsic sizing copies. Match the source state ownership and callback contract.

## Responsive

Design for 320, 390, 768, 1024, 1440 and 1920px. Respond to the container with @container variants, wrap text and stack secondary details. Scroll only within explicitly labelled local regions.

## Avoid

No remote imagery, false success states, unlabelled controls, hover-only actions, low contrast or decorative status pills. The demo is an isolated component on a quiet stage.
