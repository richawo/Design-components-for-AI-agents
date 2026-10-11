Build a nested action menu in React 19 + Tailwind CSS v4 + `motion/react`, with `lucide-react` for small 15px stroke icons. It is the menu behind a document's trigger: commands, three submenus, checkbox and radio items, mono shortcuts and one destructive item set apart. The idea is the safe triangle: you can move the pointer diagonally from a submenu row to an item lower in the submenu, across the rows beneath, and the submenu stays open. It should feel like a native desktop menu built by someone who cares, not a template dropdown.

**Tokens** (one `PALETTE` object with `dark` and `light`, written to `--dm-*` CSS variables on the root; `accent` defaults to `#8fb0ff` on dark and `#2f5bd3` on light)
- Dark: stage `#09090b`, trigger `#141416` (hover `#1a1a1d`), menu surface `#121214`, submenu surface `#151518`, ink `#f4f4f5`, body `#d0d0d6`, muted `#8b8b94`, hairline `rgba(255,255,255,0.08)`, highlight `rgba(255,255,255,0.075)`, danger `#ff7a70` with a `rgba(255,105,95,0.13)` highlight. Surface shadow: an inset top highlight at 5% white, a 24px 56px black drop at 92% and a tight 6px 14px shadow.
- Light: stage `#f3f3f0`, trigger and surfaces `#ffffff`, ink `#18181b`, body `#3a3a41`, muted `#6b6b74`, hairline `rgba(24,24,27,0.09)`, highlight `rgba(24,24,27,0.055)`, danger `#c8321f` with an 8% highlight, accent `#2f5bd3` (about 5:1 on white).
- The accent marks selection only: the tick on a checked item and the radio dot. Red is only for the destructive row. Everything else is grey.

**Layout**
- Trigger: 40px tall (44px on coarse pointers), radius 10px, 1px inset hairline, 12px left padding. A 15px file icon in muted, the label at 14px weight 500, a 15px chevron that turns 180 degrees while open.
- Menu: 8px below the trigger, anchored to its start or end edge (`align`), `width` px wide (default 256, capped at `100vw - 32px`), radius 12px, 6px inner padding, inset hairline, the shadow above. Submenus are 224px wide, 4px beside the menu, and their first row lines up with the row that opened them; a submenu that would run off the bottom of the viewport slides up by the overflow.
- Rows: 32px (44px on coarse pointers), radius 7px, 8px horizontal padding, 10px gaps. A 16px leading slot holds the icon, the tick or the radio dot, so every label starts on the same line. Label 13.5px, truncating. On the right: a mono shortcut (11px, tracking 0.06em, muted), or a mono status like "CURRENT" (10.5px uppercase), or for submenus a chevron with a mono count of ticked children ("1", "2").
- Headings: mono 10.5px uppercase, tracking 0.14em, muted, 8px above and 4px below. Separators are full-bleed hairlines with 6px above and below.
- Destructive item last, after a separator: red label and icon, a red-tinted shortcut, and a second line in muted 11.5px saying what it costs ("Removes it for 6 collaborators"), so the row is 44px and reads as different before you read it.
- `@container` on each menu surface: below a 208px menu the shortcuts hide (`@max-[13rem]:hidden`) so labels keep their room.
- Direction: submenus cascade away from the aligned edge (right for start, left for end) and flip to the other side when there is no room. When neither side fits (a phone), submenus open in place: the menu's content slides to the submenu page with a Back row at the top, and the surface animates its height between pages.

**Motion**
- First view: the trigger rises 8px out of a 6px blur over 500ms (`[0.22, 1, 0.36, 1]`), then the menu opens.
- Menu open: scale 0.96 to 1, 4px rise, 4px blur clearing, 220ms ease-out, from the anchored corner. Rows follow 14ms apart with a 3px drop and fade. Close: 140ms ease-in.
- Submenu: slides 6px out from its row with a 3px blur over 180ms; exits in 110ms.
- Highlight: one element per menu with a shared `layoutId` on `spring.ui` (stiffness 500, damping 40), so it glides between rows; it fades to the red tint on the destructive row. The row whose submenu is open keeps a quieter mark while you work inside the submenu.
- Tick: an SVG path drawn with `pathLength` 0 to 1 in 280ms each time an item is turned on. Radio dot: a 7px circle with a shared `layoutId`, so choosing another option makes the dot travel.
- Choosing an action: the row blinks once (opacity 1, 0.3, 1 over 150ms), then the menu closes and focus returns to the trigger. Checkbox and radio items keep the menu open.
- The ticked count on a submenu row cross-fades with a 7px rise when it changes.
- Safe triangle (optional `showSafeArea`): the triangle from the point the pointer left the row to the submenu's near corners draws as a dashed hairline with a 6% fill while it is active, then fades.
- Reduced motion: opacity only (150ms or less), no stagger, no blink, highlight and dot jump, tick drawn.

**Behaviour**
- Hover intent: a submenu opens after the pointer has rested 110ms on its row, and moves on that row don't restart the wait. Hovering any other row closes it at once, except along the safe path.
- Safe triangle: when the pointer leaves an open submenu's row heading toward the submenu, build a triangle from the last point on the row to the submenu's near top and bottom corners (8px slack). While the pointer stays inside it, rows it crosses are ignored. If it rests inside for 280ms, the row under it wins. Entering the submenu spends the triangle.
- Keyboard (APG menu button): Enter, Space or ArrowDown on the trigger opens with the first item focused; ArrowUp opens on the last. Inside, ArrowUp and ArrowDown move and wrap, Home and End (and PageUp, PageDown) jump, disabled rows are skipped. The arrow toward a submenu opens it and focuses its first item; the opposite arrow closes it and returns to its row. Enter and Space activate. Escape closes the innermost submenu, then the menu, returning focus to the trigger. Tab closes and carries on from the trigger. Typeahead: letters within 500ms form a search; one repeated letter cycles.
- Focus moves with the pointer, so keyboard and pointer can be mixed. Rows show a 1px inset ring on the highlight only after keyboard use.
- An outside pointer down closes everything without moving focus. Positioning stays inside the component (no portal); the usage notes say how to lift it to `document.body`.

**Accessibility**
- Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while open, focus-visible ring 2px ink at 60%, offset 2px.
- Menus: `role="menu"` labelled by the trigger or by their submenu row. Rows: `menuitem`, `menuitemcheckbox` and `menuitemradio` with `aria-checked`; submenu rows add `aria-haspopup`, `aria-expanded` and `aria-controls`; disabled rows `aria-disabled`. Headings label `role="group"` containers, separators are `role="separator"`.
- A polite live region announces what happened ("Waiting on client on", "Duplicate").

**Don't**
- No glass, no gradient, no glow, no radius above 12px, no coloured icon tiles, no accent on the highlight or trigger.
- Don't close the submenu the moment the pointer crosses a sibling row, don't open it on the first pixel of hover, and don't let the destructive item sit among the others in the same voice.
- Don't use a portal or any positioning library.

**Robustness**
The actual focused row owns keyboard activation. Keep its highlight synchronized when assistive technology, pointer movement or script changes focus; never activate a stale highlighted row.
