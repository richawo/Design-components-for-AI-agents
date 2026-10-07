Build a floating glass navigation bar in React + Tailwind CSS v4 with `motion/react`. It's a pill that floats over a dark page, condenses as you scroll, and opens a full-screen sheet on mobile. Restrained, precise and premium.

**Bar**
- Fixed to the top with 12–20px inset, centred, max width 1200px.
- A rounded-full pill: `#0c0c0e` at 70% with `backdrop-blur-xl` and `backdrop-saturate-150`, an inset top highlight and a 1px `white/8%` ring.
- Left: a 32px logo tile (a white → zinc-400 gradient rounded square with a black globe glyph and a soft white glow) plus the wordmark (17px semibold, tracking −0.03em). The tile tilts −8° on hover.
- Centre (md+): links at 14px, white/70, white on hover and on the current page.
  - A hover pill (`white/8%` with an inset highlight) slides between links via motion `layoutId` (spring stiffness 500, damping 40) and fades out when the pointer leaves the list.
  - The current page gets a 12px × 1px white/70 underline.
  - An optional mono superscript count sits at white/40 ("1.2k").
- Right: a white 36px CTA pill with black text, a soft white glow and an arrow that nudges on hover.

**Condense on scroll**
- After 80px, max width springs from 1200 → 720px and vertical padding from 8 → 6px (spring stiffness 380, damping 36).
- The wordmark folds to width 0, leaving the tile, with an sr-only name kept for screen readers.
- The shadow deepens.

**Mobile**
- The links and CTA hide. A "Menu" pill appears: the label slides to "Close" and two 1px lines morph into a cross.
- The sheet is a full-screen dialog in `#050506` with a faint radial light at the top. It reveals with a clip-path wipe from the top (0.6s, ease [0.2,0.8,0.2,1]).
- Big links (Geist semibold, `clamp(2.25rem, 11vw, 3.5rem)`, tracking −0.05em) rise from masks, 60ms apart, each with a mono index on the right and hairline dividers.
- Then a full-width white CTA, a two-column contact block (mono labels at white/40) and social links with ↗.

**Accessibility**
- `nav` with an aria-label, `aria-current` on the active link.
- The menu button has `aria-expanded` and `aria-controls`. The sheet is `role="dialog"` and `aria-modal`, and traps Tab.
- Esc closes and returns focus to the button. Page scroll is locked while open, and the sheet auto-closes if the viewport grows past md.
- With reduced motion: no springs, the sheet fades instead of wiping, and links don't rise.

**Demo**
- Under the bar sits a dark product page (radial light, a masked 64px grid, a two-tone headline, three cards with soft coloured light fields) that's tall enough to scroll and show the condense.

**Don't**
- No saturated brand-colour bar, pink accents, thick borders or hamburger icon fonts.
- Never let the bar span edge to edge on desktop.
