Build a floating glass navigation bar in React + Tailwind CSS v4 with `motion/react`. It's a monochrome pill that floats over a dark page, unfolds into place on first view, tucks itself in as you scroll, and opens a full-screen sheet on mobile. Restrained, precise and premium.

**Bar**
- Fixed to the top with 12px (20px from `sm`) inset, centred, max width 1200px.
- A rounded-full pill: `rgba(12,12,14,0.72)` with `backdrop-blur-xl` and `backdrop-saturate-150`, an inset top highlight (`inset 0 1px 0 white/6%`) and a 1px `white/8%` ring.
- Left: a 32px logo tile (a `#ffffff → #a1a1aa` gradient rounded square, radius 9px, a black globe glyph, an inset top light and bottom shade; no glow) plus the wordmark (17px semibold, tracking −0.03em). The tile tilts −8° on hover.
- Centre (md+): links at 14px, `white/70`, white on hover and on the current page.
  - A hover pill (`white/8%` with an inset highlight) slides between links via `layoutId` on spring.ui (stiffness 500, damping 40) and fades out (150ms ease-in) when the pointer leaves the list.
  - The current page gets a 12px × 1px `white/70` underline.
  - An optional mono superscript count sits at `white/40` ("1.2k"), tabular numerals.
- Right: a white 36px CTA pill with black text, an inset bottom shade, hover `#ececee`, and an arrow that nudges 3px on hover.

**Colour**
- Black, white and greys only. Page `#050506`. No coloured glows, no gradient text, no tinted tiles. Put the few surface values (bar, sheet, page) and both shadows in one token object.

**First view (≤ 900ms, ease `cubic-bezier(0.22,1,0.36,1)`)**
1. The pill settles: opacity 0 → 1 (300ms), y −10px → 0 (500ms), and its max width tweens 640 → 1200px over 650ms, so the logo and CTA travel outward as it unfolds. After this first move, width changes run on spring.ui.
2. The logo lands at 100ms; the links follow from 160ms, 50ms apart. Each block: opacity 0 → 1, y 8px → 0, blur 6px → 0, 450ms.
3. The current-page underline draws from its centre (`scaleX` 0 → 1, 400ms) once its link has landed.
4. The action cluster (CTA, or the Menu button on mobile) lands last at 420ms.

**Condense on scroll**
- After 80px, max width springs 1200 → 720px and vertical padding 8 → 6px (spring.ui). The wordmark folds to width 0, leaving the tile, with an sr-only name kept for screen readers. The shadow deepens to `0 24px 60px -20px rgba(0,0,0,0.9)`.

**Mobile**
- The links and CTA hide. A "Menu" pill appears: the label rolls to "Close" (260ms) and two 1px lines morph into a cross (350ms).
- The sheet is a full-screen dialog in `#050506` with a faint `white/6%` radial light at the top. It reveals with a clip-path wipe from the top (600ms); closing wipes back up (400ms ease-in).
- Big links (`font-display` semibold, `clamp(2.25rem, 11vw, 3.5rem)`, tracking −0.05em) rise out of their own masks, 60ms apart from 180ms, each with a mono index on the right (the current page adds a 6px white dot) and hairline dividers.
- Then, 60ms apart from 420ms, each rising 8px out of a 6px blur: a full-width white CTA, the two contact columns (mono labels at `white/40`), and social links with ↗.

**Code**
- Small named pieces: `useCondensed`, `useSheetBehaviour` (scroll lock, Esc, Tab trap, auto-close at md), `DesktopLinks`, `MenuButton`, `MobileSheet`. Motion timings live in `INTRO` and `SHEET` objects; the entrance variants are module constants (one rise set, one reduced-motion fade set) with the delay passed as `custom`.

**Accessibility**
- `nav` with an aria-label, `aria-current` on the active link.
- The menu button has `aria-expanded` and `aria-controls`. The sheet is `role="dialog"` and `aria-modal`, and traps Tab.
- Esc closes and returns focus to the button. Page scroll is locked while open, and the sheet auto-closes if the viewport grows past md.
- Reduced motion: every entrance becomes a 150ms fade, no width unfold, no springs, the sheet fades instead of wiping.

**Demo**
- Under the bar sits a short changelog page (not a landing page): a mono eyebrow, a two-tone headline ("Small releases, every week." with the second phrase at `white/40`), a lead paragraph, and four release entries (mono version and date, a title, a paragraph, a short dash list) divided by hairlines. Its blocks stagger in after the bar has landed, 70ms apart; entries below the fold reveal once at 25% visibility, and any entry already on screen waits for the page intro so everything reads top to bottom. The page's text aligns with the logo.

**Don't**
- No saturated brand-colour bar, coloured glow fields, gradient text, thick borders or hamburger icon fonts.
- Never let the bar span edge to edge on desktop.
- Don't put `filter` or `transform` on an ancestor of the fixed sheet (it would trap the sheet inside it); the entrance animates the pill and its children, not the header.

**Press feel**
- Nav links press to 0.96 under the gliding hover pill. The CTA presses to 0.96 and nudges its arrow 3px. The menu button presses to 0.96 while its label rolls between Menu and Close.
