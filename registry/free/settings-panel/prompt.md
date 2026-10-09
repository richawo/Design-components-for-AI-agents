Build a settings card in React + Tailwind CSS v4 with `motion/react` and `lucide-react`. Dark and monochrome, one focused component (no page header, breadcrumb or side nav): tabs for sections, rows of switches, segmented controls, selects and text fields, and a save bar that slides up from the card’s foot with an honest count of what you’ve changed. Everything is driven by a `sections` prop.

**Layout**
- Root `<section>` with `@container`; one card: surface, 1px line, 16px radius, inset highlight + deep shadow, overflow hidden. Demo width 680px.
- Header (24px top, 20/24px sides): `font-display` title at `clamp(1.5rem, 1.1rem + 2cqi, 2rem)`, 600, −0.035em, leading 1; a 14px muted description (max 56ch); then section tabs 20px below: 44px tall, 20px apart, a 1.5px ink underline that travels by `layoutId`, a 6px grey dot on any section with unsaved changes. The header ends in a 1px line.
- Body: a 13px faint line describing the open section (“Sent to mika@fieldnote.app. Fieldnote never emails you about emails.”), then rows separated by hairline rules, 16px vertical / 20–24px horizontal padding. Label 14px medium, hint 13px faint.
  - Switch rows keep the switch on the right at every width.
  - Segmented rows: label left, control hugging the right edge from `@lg`; full width below.
  - Select and text rows: a two-column grid from `@lg` (1fr / 1.15fr) with the field filling its column; stacked below. Text fields can carry a mono prefix (“fieldnote.app/”).
- Save bar at the foot: raised surface, 1px top line. “2 unsaved changes” (count in ink), Discard (ghost), Save (accent fill, with a ⌘S kbd from `@md`, fixed min width so Saving/Try again don’t resize it).
- Sub-components: `Section`, `Row`, `Toggle`, `Segmented`, `SelectField`, `TextField`, `SectionTabs`, `SaveBar`; hooks `useSettingsForm`, `useSaveShortcut`, `useContentHeight`, `useSettled`.

**Colour (monochrome first)**
- Dark (default): surface `#111113`, raised `#18181b`, field `#0c0c0e`, line `#232327`, rule `#1c1c1f`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`, switch track `#27272a` (hover `#303034`), off knob `#a1a1aa`. Light: surface `#ffffff`, raised `#f6f6f7`, field `#fafafa`, line `#e4e4e7`, rule `#efeff1`, ink `#18181b`, muted `#52525b`, faint `#71717a`, track `#e4e4e7`, off knob `#ffffff`.
- One `accent` prop (default: the theme’s ink, so the default is greyscale): switches that are on and the Save button; text on it is black or white by luminance. Segmented selection is an ink pill with surface-coloured text. Focus: 2px ink outline, 2px offset. Error text `#f87171` (light `#b91c1c`).
- `theme?: "dark" | "light"` also sets `color-scheme` so native select menus match. Tokens live in one PALETTE object as `--sp-*` CSS variables.

**Motion** (ease-out `[0.22, 1, 0.36, 1]`; exits ease-in `[0.4, 0, 1, 1]`; timings in one MOTION object)
- Once at 20% in view. Card rises 12px out of an 8px blur (0.5s); title, description and tabs follow 60ms apart; rows from 0.22s, 50ms apart.
- Each control settles 0.16s after its row lands: switches that are on fill (accent layer fades in, knob slides on `spring.ui` 500/40 and turns to the on-accent colour); the segmented pill lands (opacity + 0.92 scale).
- Section switch: the rows leave together (fade up 6px, 4px blur, 0.16s), the next section’s rows stagger in 40ms apart with their controls settling again, the section line cross-fades, and the card eases to the new height (ResizeObserver → animated height, 0.32s) instead of jumping.
- Save bar: grows from height 0 (0.34s) when the first change happens and its message cross-fades with a 6px offset and 3px blur as the count changes. Save shows a spinner + “Saving” in the same box; then “Changes saved” with a check lingers 1.8s and the bar collapses (exit 0.22s). A rejected save shows “Couldn’t save. Check your connection.” and “Try again”.
- Reduced motion: 150ms fades; controls set instantly; no height animation.

**Behaviour**
- `saved` and `values` live in state; the count is the number of keys that differ, so undoing a change by hand removes it. ⌘S / Ctrl+S saves (one window listener; the latest save is read from a ref). Every timer is cleaned up.

**Accessibility**
- Switches are `role="switch"` buttons with `aria-checked`, labelled and described by the row’s label and hint, 44 × 26 visual with a 44px hit area. Segmented controls are radiogroups with roving tabindex and arrow keys. Section tabs are a tablist (arrow keys) controlling a tabpanel. Real `<label>`s and native `<select>`s. The save bar is `aria-live="polite"`.

**Don’t**
- No lime or any brand colour on focus rings, nav or initials. No glass, glow or gradients. No modal for saving. No div-only controls without roles. No full page around it.
