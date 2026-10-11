Build underline tabs in React 19 + Tailwind CSS v4 + `motion/react` (icons from `lucide-react`) whose indicator glides between labels like a pen stroke: the edge in the direction of travel leads on a spring, the other edge follows a beat later, so the line stretches as it leaves and gathers to the new label's width as it lands. Panels cross-fade with a 6px slide in the same direction. When the tabs outgrow their column, the strip scrolls behind soft edge fades with a round arrow over each faded edge. Monochrome and dark first; the underline is ink unless an `accent` is passed.

**Layout**
- Root: `@container`, full width. A tab row, then a panel area.
- Tab row: `position: relative`, 44px tall. A 1px rail runs the full width at its foot, outside the scroller, so it never fades. Above it, a horizontal scroller (scrollbar hidden: `scrollbar-width: none`, no webkit bar) holds the `tablist`: a flex row, `width: max-content`, at least the row's width, tabs left-aligned with a 2px gap (4px from a 28rem container).
- Tabs: 44px tall (a full touch target), 10px horizontal padding (14px from 28rem), 10px radius for the focus ring. Label, then an optional count 6px after it. Tabs never wrap or truncate; the strip scrolls instead.
- Underline: 2px tall, fully rounded, sitting on the rail at the foot of the row, spanning the selected label's text only (not the tab's padding), so it reads as underlining a word. Measure it from the label element: `button.offsetLeft + label.offsetLeft` and `label.offsetWidth`, in the strip's own coordinates, so scrolling never moves it off its tab.
- Pill (the `indicator="pill"` option): the whole selected tab box, inset 2px horizontally and 7px vertically (30px tall), 9px radius, beneath the labels.
- Edge fades: a 56px fade at each edge, applied as `mask-image` on the scroller (never an overlay): `linear-gradient(to right, transparent 0, #000 var(--tu-fade-start), #000 calc(100% - var(--tu-fade-end)), transparent 100%)`. Each variable is 56px while more tabs lie past that edge and 0px otherwise. Register both with `@property` as `<length>` (not inherited, initial 0px) so the mask eases over 220ms.
- Overflow arrows: one per edge with more tabs past it, absolutely positioned over the fade, 40px wide by 44px tall as a hit area, with a 28px round chip pinned to the outer edge holding a 16px chevron (2 stroke). A press scrolls the strip by 70% of its visible width, smoothly.
- Scroll into view: whenever a tab is selected or focused, the strip scrolls so that tab sits at least 60px inside any faded edge (the fade plus 4px), clear of the arrows. Smooth on a pick, instant while the box is resizing, instant under reduced motion. The page never scrolls sideways.
- Panel area: `position: relative`, panel padding-top 20px. Only the selected panel is in the DOM.

**Typography**
- Tab labels: Geist 500, 14px, tracking -0.01em.
- Counts: Geist 400, 12.5px, tabular figures, formatted with `Intl.NumberFormat("en-US")`. Quiet text, never a chip.
- Demo panel lead: 15px, leading 1.55, max 56ch, muted, `text-wrap: pretty` so no single word is left on the last line. Figures: Geist display 600, `clamp(1.375rem, 4.2cqi, 1.75rem)`, tracking -0.03em, tabular. Metadata: mono 10.5px uppercase, tracking 0.12em.

**Colour (CSS variables on the root from `theme`)**
- Dark: ink `#f4f4f5`, muted `#8a8a93`, faint `#8a8a93`, rail 8% white, row lines 6% white, log surface `#18181b`, pill `#26262b` with a 1px inset hairline at 8% white, a 1px top highlight, a 1px 2px drop at 50% black and a 6px 14px drop at 70% black. Arrow chip `#1f1f23` (hover `#28282d`) with a 1px inset ring at 9% white and a soft drop. Focus ring ink at 75%. Status: ok `#3dd68c`, busy and warn `#f5b946`.
- Light: ink `#18181b`, muted `#63636c`, faint `#696973`, rail 10% ink, lines 7% ink, surface `#f4f4f5`, pill `#ffffff` with a 7% ink hairline and a 30% soft drop, arrow chip `#ffffff` (hover `#f4f4f5`), focus ink at 70%, ok `#1f9d5c`, busy and warn `#d08a00`.
- Selected label ink; others muted, moving to ink on hover (text only, no surface, so hover never reads as a second indicator). Selected count muted; others faint. Disabled tabs 40% opacity, `cursor-not-allowed`.
- The underline takes `accent` when given, otherwise the ink. Status colours appear only as 7px dots and the WARN level in the demo; everything else is grey.

**Motion**
- Indicator: two motion values, left and right edge, with the width derived from them. Moving right, the right edge animates on spring.ui (stiffness 500, damping 40) and the left on a softer critically damped spring (stiffness 300, damping 34); moving left, the roles swap. A second pick mid-flight redirects from the current position and velocity. The first placement jumps. Re-measure on every resize of the scroller or the strip, and when counts, the tab set or the indicator style change. Do not use `layoutId`.
- Panels: `AnimatePresence mode="popLayout"` keyed by the selected value, with the travel direction passed as `custom`. Enter from 6px on the side the selection came from, opacity 0 and a 3px blur, over 260ms on `cubic-bezier(0.22, 1, 0.36, 1)`. Exit 6px the other way over 170ms on `cubic-bezier(0.4, 0, 1, 1)`. No animation on the first render.
- Inside each panel: the lead and rows stagger in 50ms apart, rising 10px out of a 6px blur over 420ms; figures count up from zero over 700ms with tabular numerals; bars and sparklines grow from the baseline after the text (300ms delay, 12 to 45ms apart); meters fill last.
- Hover: label colour over 150ms ease-out. Press: the label (not the tab) scales to 0.97 over 90ms, so the indicator beneath never sits in a scaled box. Arrow chip: background and ink step on hover, the chevron nudges 1px outward, the chip presses to 0.94.
- Arrows arrive with a 4px slide outward-in and fade over 200ms, and leave over 140ms.
- Reduced motion: the indicator jumps, scrolling jumps, panels and contents use 150ms opacity only, figures land at once.

**Accessibility**
- `role="tablist"` with `aria-label` and `aria-orientation="horizontal"`. Each tab a native `button` with `role="tab"`, `aria-selected`, an id, and `aria-controls` pointing at the panel while selected. The panel is `role="tabpanel"` with `aria-labelledby` its tab and `tabIndex={0}`.
- Roving tabindex: only the selected tab is in the tab order, so Tab moves from the tabs straight into the panel.
- Arrow Left and Right move focus to the previous and next enabled tab, wrapping. Home and End jump to the ends. Disabled tabs are skipped. In `auto`, focus and selection move together. In `manual`, only focus moves; Enter or Space opens the focused tab through the native button.
- Focus-visible: a 2px outline at the focus colour drawn 6px inside the tab, instant and keyboard only. The panel's ring sits 4px outside it.
- Overflow arrows are `tabIndex={-1}` and `aria-hidden`: keyboard users scroll the strip by moving through the tabs.
- Counts are plain text read after the label. Meters use `role="meter"` with min, max and value; bar values have screen-reader text.

**Demo (the default export)**
- A stage (`#09090b` dark, `#ececee` light) filling the frame with `min-h-dvh`, centring a 680px card: 20px radius, `#0f0f11` (or `#fbfbfb`), a 1px inset ring at 8%, a deep soft shadow. The card rises 12px out of an 8px blur over 500ms; header at 60ms, tabs at 140ms, footer at 240ms.
- Header: mono kicker "TIDEWELL / PRODUCTION", the project name "tidewell-web" in display type at `clamp(1.5rem, 5vw, 1.875rem)` with tracking -0.04em, and "LHR1 · IAD1" on the right from the sm breakpoint.
- Tabs: Overview, Deployments 24, Logs, Analytics, Domains 3, Variables 18 (Storage and Settings join at 7 and 8). Each panel is a real console view: three counted stats over a 24-bar sparkline (the first stat spans the full row below a 420px container width, with the other two beneath it), recent deploys with status dots, a live log tail, seven days of visitors, domains, masked variables, storage meters and build settings.
- Footer: a hairline, then a mono button "Narrow column" (toggles to "Full width") that animates the tabs' column to 300px over 420ms on `cubic-bezier(0.65, 0, 0.35, 1)`, and on the right a key hint that follows `activation`: "← → switch tabs" or "← → move · Enter opens".
- The cursor clicks Deployments, Analytics and Logs (the line stretches and travels, panels swap), presses Narrow column, then the end arrow scrolls the strip to reveal Domains and Variables.

**Don't**
- No `layoutId` jump, no single-spring slide that keeps the line one width, no bounce or overshoot.
- No hover background on tabs, no checkmark or bold weight change on selection: the indicator is the status.
- No counts as tinted chips, no sparkle icons, no emoji, no gradient underline.
- No visible scrollbar, no fade drawn as an overlay, no fade on a strip that does not overflow, no arrow that covers the selected tab.
- No truncated tab labels, no wrapping tab row, no panel that doubles the area's height while it cross-fades.
