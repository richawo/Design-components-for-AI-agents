Build a button specimen sheet in React + Tailwind CSS (v4) with `motion/react` and `lucide-react`: eleven production-grade buttons, each shown in three sizes and laid out like a type foundry's specimen page, not a Storybook dump.

**Layout**
- Cool paper background `#ecebe6`, ink `#111113`. Max width 76rem, side padding 20px mobile, 32px tablet, 48px desktop.
- Masthead: a mono row (11–12px, uppercase, 0.14em tracking) with "Specimen № 04" left and "Buttons — set in Geist, three sizes" right at 55% ink, sitting on a 1px solid ink rule.
- Headline block on a 12-column grid: the display headline spans 8 columns ("Buttons," then a line break and "pressed with care." in italic serif ultramarine); a 16px intro paragraph (max 44ch, 70% ink) spans 4 columns, bottom-aligned to the headline.
- From 768px, a column-head row: "Style" then "Small 32 / 13", "Medium 40 / 14", "Large 48 / 15" (size names in ink, specs at 55%, tabular figures). The grid is `minmax(0,15rem) repeat(3, minmax(0,1fr))` with a 24px gap.
- An ordered list of 11 rows, each with a 1px rule at 10% ink and 28px vertical padding: a two-digit mono index (01–11, 45% ink), the style name (display, 19px, semibold, −0.02em), and a one-line note (13px, 60% ink, max 34ch). Then one specimen per size column.
- Rows: Primary, Secondary, Ghost, Destructive, Icon only (secondary and ghost squares side by side), Leading icon, Trailing icon, Loading, Split, Magnetic, Hold to confirm.
- Below 768px, the column heads disappear. Each row's three specimens wrap in a flex row, indented 40px to align with the name, with a tiny mono caption (Small, Medium, Large) under each.
- A mono footnote lists the tokens: heights 32 · 40 · 48, radii 8 · 10 · 12, focus ring.

**Button tokens**
- Sizes: sm 32px tall, 12px padding, 13px text, 8px radius, 14px icon; md 40 / 16 / 14px / 10px / 16px; lg 48 / 20 / 15px / 12px / 18px. Radii scale with size rather than one radius everywhere. Icon-only buttons are squares of the same height.
- Font: sans (Geist), weight 500, tracking −0.01em.
- Primary: ultramarine `#2b45ff`, white text, inset top highlight `rgba(255,255,255,0.22)`, inset bottom shade and a 1–2px drop shadow; hover `#2238e6`.
- Secondary: white, a 1px inset ring at 12% ink plus a hairline shadow; the ring darkens to 20% on hover.
- Ghost: transparent; hover fills 6% ink.
- Destructive: `#d23a2c`, hover `#bb3023`.
- Every button presses down 1px when active, shows a 2px `#2b45ff` focus-visible outline at 2px offset, and drops to 45% opacity when disabled.

**Special buttons**
- Loading: the label stays in the DOM at opacity 0 and a spinning `LoaderCircle` sits absolutely centred over it, so the width never changes. `aria-busy` is set and a polite live region says "saving". In the demo, clicking loads for 1.8s, and the medium one auto-plays once on mount.
- Split: the primary action plus a chevron segment, separated by a 1px darker rule (`#1a2fd0`). The chevron opens a 256px menu (white, 12px radius, 1px ring and soft shadow) of `menuitemradio`s with a label and a hint ("Thursday 9:00, when they open things."). Picking one becomes the main action. ArrowUp/Down/Home/End move focus, Esc closes and returns focus, and a click outside closes it. The menu fades in and slides 4px down over 160ms.
- Magnetic: an ink pill with an ultramarine arrow disc on the right. A padded wrapper (14/18/22px) is the magnetic field. The button follows the mouse by 32% of the pointer's offset and the label by a further 45% of that, both on springs (stiffness 260, damping 18), and settles back on leave. Mouse only, never on touch.
- Hold to confirm: a pale red button (9% red fill, 28% red inset ring, red text) with a trash icon. While it's held, a solid red copy of the button with white text is revealed left to right through `clip-path: inset(0 X% 0 0)` driven by a motion value over 1200ms, linear. Letting go early rewinds over 350ms. On completion it shows a check and "Deleted", announces it through an assertive live region, then resets after 2.2s. Pointer capture keeps the hold if the finger drifts. Space and Enter hold too (ignore key repeat), keyup cancels, and so does blur.

**Motion**
- Ease `[0.2, 0.8, 0.2, 1]` throughout. Transitions on colour, shadow and transform run at 150ms.
- With `prefers-reduced-motion`, the magnetic effect is off and the menu only fades.

**Accessibility**
- Real `<button type="button">` elements. Icon-only buttons have `aria-label`. Decorative icons are `aria-hidden`.
- The split trigger has `aria-haspopup="menu"`, `aria-expanded` and `aria-controls`. The menu items use roving tabindex.
- The hold button's accessible name explains the gesture: "Hold to delete. Press and hold to confirm."

**Don't**
- No gradients on buttons, glows, or glassmorphism.
- Don't use the same radius at every size, and don't let a loading state change the width.
- Don't present it as a grid of identical cards. It's a specimen: rules, indices, captions, alignment.
