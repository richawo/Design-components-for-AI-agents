Build a custom single-value select in React 19 + Tailwind CSS v4 + `motion/react`, with `lucide-react` for two small icons. It must behave like the native select: typeahead, Home and End, arrow keys, Enter and Escape. It should look like a precise, quiet tool on a black stage, not a dropdown from a template. The idea: the panel unfolds out of the trigger, the highlight glides between rows on a spring, and one check draws on the row you choose before the panel folds away.

**Tokens** (one `PALETTE` object with `dark` and `light`, written to `--sl-*` CSS variables on the root; `accent` defaults to `#7dd3a8` on dark and `#1f9d6b` on light, where mint is too faint on white)
- Dark: field `#141416` (hover `#1a1a1d`), panel `#111113`, ink `#f4f4f5`, body `#c4c4ca`, hint `#8a8a93`, hairline `rgba(255,255,255,0.08)`, highlight `rgba(255,255,255,0.07)`, accent `#7dd3a8`. Panel shadow: an inset top highlight at 5% white, a 28px 60px soft black drop, and a 4px tight shadow.
- Light: field `#ffffff`, hover `#fafafa`, panel `#ffffff`, ink `#18181b`, body `#3f3f46`, hint `#6b6b74`, hairline `rgba(24,24,27,0.1)`, highlight `rgba(24,24,27,0.05)`, accent `#1f9d6b` (about 3.4:1 on white).
- The accent is used on one thing only: the check on the chosen row. It is the `accent` prop, and the palette supplies the per-theme default.

**Layout**
- Root `@container`, `max-width 320px`, full width below that. A mono label (11px, uppercase, tracking 0.12em, hint colour) sits 8px above the trigger.
- Trigger: `md` 44px tall, 14px text, 14px horizontal padding, radius 10px, 1px inset hairline. `sm` is 36px tall with 13px text. The value is on the left, its mono hint (11.5px) follows it, and a 16px chevron sits on the right and turns 180 degrees while open.
- Panel: the trigger's width, 6px below (or above) the trigger, radius 12px, 1px inset hairline, overflow hidden. The list scrolls at a maximum of 320px with a 6px inset, so the fold lands mid-row. Rows are 44px (`md`, matching the trigger) or 32px (`sm`, 44px on coarse pointers), radius 8px, 10px horizontal padding, label on the left (truncates), mono hint on the right, and a 16px slot at the far right for the check.
- While more rows lie below the fold, the list's bottom 32px fade to transparent, so a cut row reads as scrollable rather than broken.
- Group headings: mono 10.5px uppercase, tracking 0.14em, hint colour, 8px above and 4px below. Each group after the first sits under a hairline with 4px of space above it.
- Searchable: a 44px filter row at the top of the panel with a 15px search icon and a borderless 16px input (16px always, so iOS does not zoom on focus).
- `@container` scopes the component for consumers; the panel's width follows the trigger, so no viewport breakpoint is needed. Below a 224px container the time-zone hints hide (`@max-[14rem]`) so the names keep room, and small sizes take the 44px touch floor on coarse pointers (`[@media(pointer:coarse)]`).

**Motion**
- First render: the whole block rises 8px out of a 6px blur over 500ms (ease-out `[0.22, 1, 0.36, 1]`) after a 50ms delay. Blur is dropped at rest.
- Opening: the panel unfolds from the trigger edge (scaleY 0.9, 6px drift, 4px blur) over 260ms ease-out, with origin at the touching edge. Closing: scaleY 0.94 and a 3px blur over 140ms ease-in.
- Highlight: one element with a shared `layoutId` on `spring.ui` (stiffness 500, damping 40), so it glides between rows and never jumps. Its id is new for each opening, so the highlight starts in place when the panel unfolds instead of gliding from its last position.
- Press: a row's content scales to 0.98 in 90ms while pressed, so a tap is felt, not only shown in colour.
- Choosing: the trigger value swaps at once (keyed, the old label rises out 6px with a 3px blur as the new one rises in over 280ms). The panel holds open for 300ms so the check draws on the chosen row, then closes. Input is ignored during that hold, so a second Enter cannot choose twice. Any outside pointer down or Tab closes it at once.
- Check: a 14px SVG path with `pathLength` from 0 to 1 over 320ms, delayed 40ms. It mounts with the selection, so it draws on the row you just chose and again each time the choice changes.
- Press: the trigger scales to 0.985 on press in 90ms, springing back over 150ms on release.
- Reduced motion: no hold, the panel closes at once on a choice. Opacity fades of 150ms or less, with no travel, no blur and no spring. The check is already drawn.

**Behaviour**
- Without `searchable` the trigger is a `combobox` with `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` (only while open and while there are rows), `aria-labelledby` (label and value), and `aria-activedescendant` pointing at the highlighted option while the panel is open. With `searchable` the trigger is a `button` with `aria-haspopup="listbox"` and `aria-expanded`, and the filter field is the only `combobox`, so screen readers never announce a combobox inside a combobox.
- Keys while closed: Enter, Space, ArrowUp and ArrowDown open the panel. A printable character chooses the first match immediately, with no confirmation hold, so typing carries on: `mex` lands on Mexico City, and `to` typed after a pause lands on Toronto.
- Keys while open: ArrowDown and ArrowUp move one row without wrapping; Home and End jump; PageDown and PageUp move five rows; Enter and Space choose the highlighted row; Escape closes and returns focus to the trigger; Tab closes without moving focus.
- Typeahead: characters typed within 600ms form one search. A single letter searches from the next row, so repeating it cycles through the matches. A longer run stays on the first match from the current row.
- Placement: `auto` measures the viewport on open and picks the side with room (below first). It re-measures on resize. `top` and `bottom` are fixed. The panel's height comes from its rows, including the 9px divider above each group after the first.
- Pointer: moving over a row highlights it. Pointer down on a row keeps focus where it was. An outside pointer down closes the panel without restoring focus.
- The highlighted row scrolls into view with the list's own scroll, not the page's.
- Disabled: 40% opacity, `not-allowed` cursor, no hover response, and an open panel closes.

**Accessibility**
- Focus rings: 2px ink at 60% opacity, offset 2px, shown by `focus-visible` only.
- The listbox has `aria-labelledby` from the label. Options are `role="option"` with `aria-selected`. Groups are `role="group"` labelled by their heading, whose text sits in a `role="presentation"` element. Empty results are a polite status line outside the listbox, and no empty listbox is rendered.
- Touch targets: 44px trigger and 44px rows on `md`, and no action depends on hover alone.

**Don't**
- No oversized rounded panels (nothing above 12px radius), no glass, no gradient, no icon on each option, no coloured group tiles, no accent on the highlight or the trigger.
- Do not move focus into the list when it opens with the pointer, and do not wrap the arrow keys. Do not use a portal: the panel positions inside the component.
