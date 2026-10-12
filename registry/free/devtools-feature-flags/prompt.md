Build a feature-flag panel in React 19 + Tailwind CSS v4 (with `@container` queries) + `motion/react`. It is the flags page of a deployment console: one flag opens at a time, its environments are switches, the rollout is a slider, the targeting rules read as one sentence, and the kill switch asks once.

**Layout**
- A `section` with `@container`, max-width 920px, 20px radius, surface `#0d0d0f` (light `#ffffff`), an inset 1px hairline, a 1px top highlight and a deep shadow `0 40px 80px -40px rgba(0,0,0,0.9)`. Padding 20px, 24px from `@xl`.
- Header: an accent dot and the project name in mono 12.5px; on the right, “4 flags” in mono 11px.
- The list sits in a well (`#09090a`, light `#fafafa`), 14px radius, hairline. One flag is open. A closed row shows the name, the key in faint mono, the percentage, and which environments are on.
- The open detail holds the description, the owner, three environment switches, the rollout, the targeting sentence, a verdict, and the kill switch. Below `@lg` each switch is a full-width row and Kill is full width. From `@lg` the label sits beside its switch, the three environments share one row, and Kill sits at the end of its sentence.

**Typography**
- Names are Geist 14px. Keys, the percentage, the owner and the verdict are Geist Mono. The sentence is 13.5px, leading 1.55, with the active clauses in ink.

**Colour**
- Dark: ink `#ededef`, muted `#98989a`, faint `#939399`, hairlines `rgba(255,255,255,0.08)`. Light: ink `#17171a`, muted `#5d5d5f`, faint `#62626b`.
- Error colour only for “Killed” and the Kill label: `#f07c80` (light `#c2353b`).
- One accent, default `#7cc4ff`: the open flag’s edge, the rollout fill, and a verdict that says the sample organisation is served. No per-environment hues.

**Behaviour**
- Each environment and each targeting clause is a switch. Clauses that are off are struck through, and the sentence is rebuilt from the clauses that are on: “Served when the organisation is on the Team plan and the request is served from London or Frankfurt.”
- The rollout is a slider from 0 to 100. Dragging sets the percentage from the pointer. Arrow keys step by 5, Shift by 10, Home and End jump to the ends.
- A sample organisation, Northwind Ltd, sits in bucket 41. Below that percentage the verdict says they fall outside the rollout. At or above it, and with production on and a rule on, the verdict says they are served.
- Kill asks once, in the same row: Cancel, then Kill now. The row reads “Turns the flag off in every environment.” Confirming stores a snapshot, sets the rollout to 0 and turns every environment off. The line then reads “Off in every environment.” Undo restores that snapshot. Editing a killed flag clears the killed state.

**Motion**
- Header and list rise 10px out of a 6px blur, 60ms apart, 560ms on `cubic-bezier(0.22, 1, 0.36, 1)`.
- The open detail grows over 320ms and closes in 180ms on ease-in.
- A switch thumb travels 16px on a spring (stiffness 500, damping 40).
- Reduced motion: opacity only, 150ms or less; no blur, rise, or spring.

**Accessibility**
- Each flag row is a button with `aria-expanded`. Environment and rule controls are switches. The rollout is a slider with `aria-valuenow`.
- The verdict is `aria-live="polite"`.
- Focus rings are 2px ink outlines, keyboard only. Touch targets are 44×44px below `@lg`.

**Don't**
- Don't colour environments or whole rows. Tone belongs to the verdict and the kill label.
- Don't put the kill switch in a modal. It asks once, in the row.
- Don't reset the other flags when the rollout control changes. It edits the open flag only.
- Don't ping the header dot. This panel is not a live stream.
