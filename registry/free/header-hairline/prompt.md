Build a full-width site header in React + Tailwind CSS v4 + `motion/react`, at the calibre of vercel.com/geist: transparent at the top of the page, then a hairline and a backdrop blur fade in and the bar condenses once the page moves. One signature detail: a single hover highlight that glides between links and stretches toward where it is going.

**Layout**
- `<header>` is `sticky top-0 z-40`, full width. Inside, a bar `max-w-[1280px] mx-auto px-4 sm:px-6`, made the `@container`.
- Height animates 64px → 56px (`condenseAt`, default 8px of scroll), 320ms `cubic-bezier(0.22,1,0.36,1)`.
- Desktop (container ≥ 896px): grid `auto 1fr auto` (links centred in the middle cell); from 1200px of container width switch to `1fr auto 1fr` so the links are optically centred on the page and the search chip shows its "Search docs" label.
- Left: a 22px drawn mark (two slanted parallelograms, the second at 55% opacity) + wordmark. Centre: five links, `h-10 px-3`. Right: search chip, "Sign in" text link, white primary button, all `h-8`, gap 8px.
- Below 896px: wordmark, a 44px search icon button, the primary button (from 672px) and a 44px burger. All right-cluster text is `whitespace-nowrap`.

**Typography**
- Wordmark: `font-display` 17px, weight 600, tracking −0.04em.
- Links: 13.5px, tracking −0.005em, `white/55` at rest; hovered and current links go to white.
- Buttons: 13.5px, weight 500. Kbd chip: `font-mono` 11px, "⌘K" on Apple platforms, "Ctrl K" elsewhere (detected after mount, default ⌘ so SSR matches).
- Mobile menu rows: 20px, weight 500, tracking −0.025em, 56px tall.

**Colour**
- Monochrome: black, white and greys only. Keep page, surface and menu colours in one `COLOR` token object.
- Page `#000`. Surface layer: `bg-black/72` + `backdrop-blur-xl backdrop-saturate-150` + `border-b white/9%`; solid `#000` while the mobile menu is open.
- Hover highlight `white/7.5%`, radius 8px, 32px tall. Current-route dot: 4px white circle 3px above the link's bottom edge.
- Search chip: inset 1px `white/10%` ring (16% on hover), kbd `white/6%` with an inset lower lip `0 -1px 0 white/6%` and a 1px black drop.
- Primary: `#fff` on black text, hover `#e8e8ea`, inset bottom shade `0 -1px 0 rgba(0,0,0,.12)`.

**Motion**
- First view (≤ 800ms, ease `cubic-bezier(0.22,1,0.36,1)`): the wordmark lands at 40ms, the links from 120ms 45ms apart, then the right cluster last (search chip, Sign in, primary button, or the burger on narrow bars) from 360ms, 45ms apart. Each block: opacity 0 → 1, y 8px → 0, blur 6px → 0, 450ms. The current-route dot pops in (scale 0 → 1, 300ms) once its link has landed; after that it only glides.
- Entrance variants are module constants with the delay passed as `custom`. Because each `<li>` carries the entrance filter, it becomes its link's `offsetParent`: measure the `<li>`s (their `offsetLeft` inside the positioned `<ul>`) for the highlight, not the links.
- The surface (blur + hairline) is a separate absolutely positioned layer whose opacity fades 0 → 1 in 240ms ease-out (out in 160ms ease-in). Never transition `backdrop-filter` itself.
- Hover highlight: one absolutely positioned span whose left and right edges are two motion values. Entering the list from outside, it appears in place (jump, fade in 140ms). Moving between links, the leading edge runs on a stiff spring (660/46) and the trailing edge on a soft one (320/31): it stretches toward the next link and contracts on arrival. Leaving fades it out in 160ms. It follows keyboard focus too (only on `:focus-visible`).
- Current route: the 4px dot is a `layoutId` element on `spring.ui` (500/40), so it glides when the route changes.
- ⌘K / Ctrl K anywhere calls `onSearch`; the kbd chip physically presses (1px down, inset shadow) while the key is held.
- Burger: two 1.5px lines at ±3.5px rotate to ±45° on a 500/34 spring. Mobile menu fades in 200ms; rows stagger in 45ms apart (y 8px → 0, blur 6px → 0, 450ms), the two buttons follow.
- Press: every control scales to 0.97. Reduced motion: every entrance is a 150ms fade, no glide/stretch (the highlight jumps), no height tween, opacity-only menu.

**Accessibility**
- `nav aria-label="Main"`, `aria-current="page"` on the current link. Search chip has an `aria-label` naming the shortcut and `aria-keyshortcuts`.
- Burger: `aria-expanded`, `aria-controls`, label switches "Open menu"/"Close menu". The menu is `role="dialog" aria-modal`: page scroll locked on `<html>`, Tab trapped inside the header, Escape closes and returns focus to the burger, it closes itself if the bar grows past 896px.
- While the menu is open the bar's primary button is hidden from focus (it is repeated in the menu).
- Focus-visible: 2px `white/70` ring, 2px offset on black.

**Code**
- Small named pieces: `useCondensed`, `useCommandK` (returns whether the key is held and whether to show ⌘ or Ctrl), `useMenuBehaviour` (scroll lock, Tab trap, Esc, auto-close at 896px), `HoverLinks`, `SearchChip`, `Burger`, `MobileMenu`. Spring and timing values live in named constants (`EDGE`, `INTRO`, `HEIGHT`).

**Demo**
- Under the header sits one Kestrel docs article, not skeleton bars: a mono breadcrumb (Docs / Deployments / Rollbacks), the headline "Roll back a deploy in one command" (`clamp(2.25rem, 1.5rem + 3vw, 3.75rem)`, tracking −0.045em), a 17px lead, a mono meta line, then a CLI block and two short sections, max width 680px, aligned with the wordmark. The first blocks stagger in 60ms apart from 340ms, after the header; later sections reveal once at 25% visibility, and any already on screen wait for the page intro.

**Don't**
- No glass pill, no glow behind the CTA, no gradient wordmark.
- Don't animate the highlight with plain `layoutId` (it slides as a rigid block); the two-edge stretch is the point.
- Don't let the right cluster wrap; drop labels before anything breaks onto two lines.
