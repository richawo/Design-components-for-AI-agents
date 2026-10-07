Build a floating pill navbar in React + Tailwind CSS (v4) with `motion/react`. It should feel like the header of a confident independent studio: a solid black capsule hovering over a bold page, which tucks itself in as you scroll.

**Layout**
- A `fixed` header across the top, `pointer-events-none`, with 12px side/top padding (20px from `sm`). Inside it, one `pointer-events-auto` pill: `w-full`, `max-width: 1200px`, `rounded-full`, background `#111111`, text `#f5f3ef`, padding 8px vertical, 16px left, 8px right.
- Three groups, `justify-between`: logo (36px cream circle holding an SVG arch mark with a small pink flame, then the wordmark in display 22px bold, tracking −0.05em); the links, centred; the CTA.
- Links: 44px tall, 16–20px horizontal padding, 15px medium, tracking −0.01em. An optional count sits as a 10px mono superscript at 55% white. The active link gets a 4px pink dot 5px above the bottom edge and `aria-current="page"`.
- CTA: 44px pink (`#ff9bd2`) pill, 15px semibold ink text, with a 32px black circle holding a pink arrow that rotates −45° on hover.
- Below `md` the links and CTA hide. A "Menu" button appears instead (44px, `white/10` pill) with a 20px icon made of two 2px bars.
- The mobile sheet is `fixed inset-0` in cobalt `#2b2bf5`, sitting under the pill (the pill stays on top, so its button becomes "Close"). It has 112px top padding and 20px sides. It holds: the links at `clamp(2.75rem, 13vw, 4.5rem)` display bold, leading 0.95, tracking −0.05em, each in a row with a 20% white bottom rule and a mono index ("01") on the right; then, pushed to the bottom, a full-width 56px pink CTA, a two-column `dl` of contact details (mono 11px uppercase labels at 60% white) and a row of text social links with ↗.

**Typography**
- Display (Geist at tight tracking) for the wordmark and sheet links, sans (Geist) for the links, mono (Geist Mono) for counts, indices and labels.

**Colour**
- Pill `#111111`, text `#f5f3ef`, hover highlight `rgba(255,255,255,0.13)`, accent pink `#ff9bd2` (CTA, active dot, focus rings), cobalt `#2b2bf5` sheet.
- The demo sets it over a cobalt hero with a white 8.5rem headline and a `#f5f3ef` work section, so there's something to scroll past.

**Motion**
- Hover highlight: one `motion.span` with a shared `layoutId` inside a `LayoutGroup` whose id comes from `useId()`. It slides between links on hover and keyboard focus (spring stiffness 500, damping 40) and fades out when the pointer leaves the list.
- Condense: `useScroll` + `useMotionValueEvent`. Past `condenseAt` (80px) the pill's `maxWidth` springs from 1200 to 720 and its vertical padding from 8 to 6px (spring 380/36), the wordmark's width animates to 0, and a soft shadow plus a hairline ring appear.
- Menu icon: the two bars sit 7px apart and rotate to ±45° to form a cross (0.35s, ease [0.2, 0.8, 0.2, 1]). The button's label swaps Menu/Close by sliding in a mask.
- Sheet: reveals top-down with `clipPath: inset(0 0 100% 0) → inset(0)` over 0.6s. Each link rises from `y: 100%` inside an overflow-hidden row, staggered 60ms from a 180ms delay. The footer fades up at 450ms.
- Reduced motion: no springs (instant), and the sheet just fades.

**Accessibility**
- `nav aria-label="Main"`. The menu button has `aria-expanded` and `aria-controls`. The sheet is `role="dialog" aria-modal="true"`.
- While the sheet is open: lock page scroll, autofocus the first link, trap Tab within the header, close on Esc and return focus to the button, and close automatically if the viewport grows past 768px.
- Visible focus rings in pink or white on every link and button, all targets at least 44px tall, and the wordmark kept as sr-only text when it folds away.

**Don't**
- No glassmorphism or backdrop blur. The pill is solid black on purpose.
- No underline-on-hover links. The sliding pill is the idea, so keep it to one shared element.
- No hamburger that just drops a small white list. On mobile the menu is a full-screen moment with big type.
