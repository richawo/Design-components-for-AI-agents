Build a refined, dark product footer in React + Tailwind CSS v4 + `motion/react`. It should feel like the footer of a serious developer platform: a quiet hairline grid of links, a live status pill, a theme switch and a locale menu. The detail people remember is the light: a soft pointer-following glow that lives *inside* the grid cells, clipped by the hairlines like light through panes.

**Layout**
- `<footer>` is the `@container`. Background `#050505`, full-bleed top rule `white/8%` (a drawn span, `100cqw`). Content max-width 1280px, gutters 20px → 32px (`@2xl`) → 40px (`@6xl`).
- The grid: 5 cells. At `@6xl` (≥1152px) `minmax(0,1.5fr) repeat(4, minmax(0,1fr))`: brand cell, then Product, Developers, Company, Legal. From `@2xl` up to `@6xl` (so 768–1024px too) the brand spans a full row (brand left, release pill right) above 4 equal columns. Below 640px it becomes an accordion.
- Hairlines, all `white/9%`, 1px: left and right frame edges, a vertical divider before each link column (not before the first column in the 2-row layout), a rule under the brand row in the 2-row layout. The bottom rule runs edge to edge of the footer (`100cqw`), not just the grid.
- Brand cell: 24px mark (an off-white rounded square, radius 7, with a black pennant on a mast), name at 18px; one line of description at 15px / 1.6, `white/55`, max 30ch; a release pill pinned to the bottom of the cell (`margin-top: auto`): mono version chip + label + arrow. Padding 40/32/48.
- Link columns: padding 32/24/40. Mono 11px uppercase heading at `white/40`, 20px gap, then links at 14.5px, 32px rows. Optional badge (mono 10px uppercase, `white/5%` fill, hairline ring) and ↗ for external links.
- Bottom bar (20px vertical padding): left, the status pill (dot, label, a hairline divider, then the 90-day uptime in mono 11px tabular figures, `white/45`) and mono copyright (11px uppercase, tracking .12em, `white/40`); right, the locale button and the theme switch.
- Below 640px: brand stacked; each column becomes a 56px disclosure row (mono 12px uppercase, plus icon whose vertical stroke rotates 90° and fades to make a minus), hairline above each; open lists are a 2-column grid of 44px links. The bottom bar stacks: status pill, then locale + theme in one row (both 50px tall, theme buttons 44px), copyright last.

**Typography**
Geist for everything except mono metadata (Geist Mono). Brand 18px semibold, tracking −0.025em. Links 14.5px, tracking −0.005em. No sizes below 10px.

**Colour**
Surface `#050505`, text white at 100/75/60/55/40%. Status colours: ok `#34d399`, degraded `#fbbf24`, outage `#f87171`; semantic, and the only colour in the footer. Keep colours in one `COLORS` token object. Popover surface `#0d0d0e` with a `white/9%` inset ring, inset top highlight and `0 24px 60px -12px rgba(0,0,0,.9)`.

**The light (signature)**
- One rAF loop writes CSS variables; no React state per frame. On pointermove (mouse only), store the target in grid coordinates and lerp the light position at 0.2 per frame; intensity eases in at 0.12 and out on leave.
- Every cell paints its own radial gradient at `(pointer − cell offset)`: `radial-gradient(400px circle, white/10% → white/4.5% at 32% → white/1.2% at 58% → transparent 75%)`, so the glow is clipped to each cell. The cell under the pointer gets full intensity, every other cell 32%, eased at 0.16 per frame, so crossing a hairline reads as stepping into a brighter pane.
- The hairlines catch it: each vertical divider overlays `radial-gradient(150px circle at pointer, white/50%, transparent 75%)`; the top and bottom rules do the same along x.
- Cache cell offsets (offsetLeft/Top/Width/Height) on resize, never read layout per frame. Stop the loop when everything has settled.

**Interaction**
- Hovering (or keyboard-focusing) a link dims its siblings to `white/40%` while it goes to white (`group-has-[a:hover]`). 150ms colour only; press nudges 1px down.
- Status pill: 8px dot with a breathing halo (scale 1 → 2.6, opacity .55 → 0, period 3.2s ok, 2.2s degraded, 1.4s outage) plus a soft glow; the dot's colour tweens 400ms; the label cross-fades with 6px offset and 3px blur. Hover lifts the fill to `white/5.5%`, the arrow nudges 2px.
- Theme switch: radiogroup of three 30px icon buttons (System, Light, Dark, all drawn 15px icons) in a hairline pill; the thumb glides with `layoutId` on spring stiffness 500, damping 40. Arrow keys move and select with roving tabindex. It only reports through `onThemeChange`.
- Locale: a button (globe, label, chevron that rotates 180°) opening a listbox *upward*: 240px wide, 36px options (44px on touch) with label, mono code and a check on the selected one; the highlight glides between options with `layoutId`. Opens with opacity + 6px rise + scale .97 → 1 over 220ms; closes in 140ms. Arrow keys, Home/End, Enter/Space, Escape (returns focus), Tab and outside click close it.
- Accordion: height auto ↔ 0 over 360ms ease-out, opacity 300/180ms; collapsed lists are `inert`.
- Entrance, once, in two blocks (each at 25% visible, sharing one clock so they play in order together and a block scrolled to later starts at once). Items rise 12px out of an 8px blur over 600ms `cubic-bezier(0.22, 1, 0.36, 1)`.
  - Grid (0ms): the top and bottom rules draw from the centre (scaleX, 800ms), the frame edges and dividers draw down from the top (scaleY), each divider 60ms after the last. Then each cell from 80ms, 60ms apart: brand mark pops (scale .4 → 1), name, description, release pill 50ms apart; each column's heading, then its links 25ms apart (on mobile, the disclosure rows and their hairlines). Links take the reveal state explicitly because the accordion's height animation breaks variant inheritance.
  - Bottom bar (500ms, lands last): status pill, copyright, locale, theme switch 50ms apart. 220ms after the pill lands its dot pops in and starts breathing (paused while offscreen); from 300ms the uptime counts 0 → 99.98% over 800ms as a motion value, sharpening out of a 3px blur.
- Press: 0.98 on pills, 0.94 on theme buttons. Focus: 2px `white/70%` outline, offset 2px, keyboard only.
- Reduced motion: 150ms fades only, uptime set instantly, no breathing, light snaps instead of easing, instant accordion and popover.

**Code**
Hooks: `useReveal` (scroll reveal with the shared clock), `useControllable` (theme and locale), `useCompact` (ResizeObserver), `useCellLight` (the rAF light), `useListbox` (popover state, keys, outside click, focus). Sub-components: `BrandBlock`, `LinkColumn`, `StatusPill`, `ThemeSwitch`, `LocaleSelect`, `LocaleOption`. Timeline constants in one `T` object.

**Accessibility**
Each column is a `nav` labelled by its heading. Disclosure buttons carry `aria-expanded`/`aria-controls`. The theme switch is a `radiogroup` with labelled `radio`s. The locale control is `aria-haspopup="listbox"` with `aria-activedescendant`. The status label is `aria-live="polite"`; the counting uptime is `aria-hidden` with an sr-only "99.98% uptime over 90 days". External links say "(opens in a new tab)" to screen readers.

**Don't**
- No glowing border around the whole footer, no gradient text, no social icon soup.
- Don't let the light cross hairlines as one blob; the clipping is the point.
- Don't make the status dot ping like an alarm when everything is fine.
- Don't use a native `<select>` for locale or a checkbox toggle for a three-way theme.
