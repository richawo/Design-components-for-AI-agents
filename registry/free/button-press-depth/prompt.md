Build a press-depth button in React 19 + Tailwind CSS v4 with `motion/react` for the demo entrance. The button is an everyday primary, secondary, ghost or destructive action with physical depth: a 2px base edge sits under the face, the face lifts a hair on hover and sinks into the edge on press. It should feel like a key, not a painted rectangle.

**Anatomy**
- An outer `span` (relative, inline-grid, with 2px bottom padding on depthed variants) holds an absolutely positioned base and the `button` face. The base fills the bottom 2px under the face, in the variant's edge colour, with `border-radius` matching the face. It never moves. The face sits in normal flow above it.
- The face is an inline-grid. Three slots share grid cell 1/1: the idle slot (leading glyph, label, trailing glyph), the loading slot (spinner) and the success slot (check). Optional text can sit beside either glyph. The box is as wide as its widest state, so nothing reflows. `loadingLabel` and `successLabel` are optional: without them the spinner and check replace the label itself.
- Sizes: `sm` 32px tall, 8px radius, 12px horizontal padding, 13px label, 6px gap, 14px glyph. `md` 40px, 10px radius, 16px padding, 14px label, 8px gap, 16px glyph. `lg` 48px, 12px radius, 22px padding, 15px label, 10px gap, 18px glyph. Geist 500, tracking -0.01em. `sm` and `md` expand their hit area to 44px; the drawn face stays 32px or 40px.
- `block` makes the wrapper a full-width `grid` and the face `w-full`, so the base edge stretches with it: the stretched mobile call to action. The face is a single `minmax(0, auto)` column and the label truncates, so a label too long for its box ends in an ellipsis instead of overflowing.
- Glyph slots sit on both sides. A boolean `icon` shows a 16-unit arrow after the label; `leadingIcon` and `trailingIcon` take any node, and `trailingIcon={null}` hides the trailing one. The spinner is a partial ring at 1.5 weight. The check is a 3-point path drawn by `pathLength`.

**Depth (the signature)**
- Rest: the face sits at 0. The base shows 2px below it.
- Hover (pointer devices only): the face rises 1px, so the base shows 3px. 120ms, ease-out `cubic-bezier(0.22, 1, 0.36, 1)`. The built-in trailing arrow nudges 1.5px toward the action on the same timing.
- Press (pointer down, Space or Enter down, ignoring key repeat): the face sinks 2px and covers the base. The background moves to the press colour. It releases on pointer up, leave, cancel, blur or key up. Touch gets the same press.
- Hover and press are set from pointer and key handlers in React state, not from CSS `:hover`, so scripted demos show them too.

**Colour (monochrome first; the accent is the one colour)**
- Primary: fill = `accent` (default `#f4f4f5` on dark and `#18181b` on light, a monochrome fill; set it to a brand colour to rebrand). Base edge = `color-mix(in oklab, accent 62%, black)`. Label is white or near-black, whichever has the higher WCAG contrast on the fill. Top inset highlight `rgba(255,255,255,0.24)`.
- Hover and press, every raised variant: hover is one clear step away from the label ink. A light fill (near-black label) darkens to `fill 93%` mixed with black; a dark fill (white label) lightens to `fill 89%` mixed with white. Take the direction from the fill, never from the theme, or a near-white primary mixed toward white shows no hover at all. Press goes darker still: `fill 86%` (light fills) or `88%` (dark fills) mixed with black.
- Secondary, dark: fill `#1f1f24`, edge `#060607`, label `#f4f4f5`, highlight `rgba(255,255,255,0.08)`. Secondary, light: fill `#ffffff`, edge `#c4c5cc`, label `#18181b`, highlight `rgba(255,255,255,0.95)`.
- Destructive, dark: fill `#d6393f`, edge `#7f1d22`, label `#ffffff`. Light: fill `#dc2626`, edge `#8f1717`.
- Ghost: no fill, no edge, no highlight at rest. Hover `rgba(255,255,255,0.07)` (light `rgba(24,24,27,0.06)`), press `rgba(255,255,255,0.12)` (light `rgba(24,24,27,0.10)`).
- Focus: a 2px outline in the variant's ring colour with a 2px offset, shown on keyboard focus only.

**States**
- `idle`: interactive, as above. Uncontrolled, only a promise returned from `onPress` starts loading. A plain or synchronous `onPress` leaves the button idle, with no spinner and no check. A rejected promise returns to idle and announces `errorLabel` (default "Didn’t save").
- `loading`: the label is replaced by the spinner, and `loadingLabel` adds text beside it if set (opacity, a 4px rise and a 2px blur that clears, 200ms ease-out). The spinner turns at Tailwind's animate-spin pace (1s), only while loading shows. Under reduced motion a frozen arc would read as stuck, so it becomes three 3px dots that fade 0.3 to 1 in turn (1.2s, 0.2s apart): opacity only, nothing moves. The button sets `aria-busy` and ignores presses. It does not dim.
- `success`: the label is replaced by the check, and `successLabel` adds text beside it if set. The check draws in over 340ms after a 120ms delay. Uncontrolled use returns to idle after `successMs` (1600ms).
- `disabled`: 40% opacity on the whole component, `cursor-not-allowed`, the `disabled` attribute set, no hover or press response.

**Motion rules**
- Everything interruptible: CSS transitions on transform, background and box-shadow, so a re-hover or a second press reverses mid-flight.
- Reduced motion: no translate and no blur. The press is a colour change, and the base edge fades to 0 while pressed. Opacity fades stay at 150ms. The spinner becomes the three fading dots.

**Accessibility**
- A native `button`. `type` defaults to `button`. Disabled uses the `disabled` attribute, which takes it out of the tab order.
- Inactive label slots are `aria-hidden`, so the accessible name is always the visible label.
- A visually hidden `role="status"` region announces `successLabel`, or Done, when success lands, and `errorLabel` when a promise rejects. While loading with no `loadingLabel`, the button's aria-label reads "<label>, in progress". Success with no `successLabel` reads "<label>, done", so the focused button keeps a name.
- Space and Enter press from the keyboard; the native click still fires.
- `touch-action: manipulation`, no tap highlight, so presses respond at once on touch.

**Demo (dark stage `#0a0a0b`, or light `#f4f4f5` when the theme control is Light)**
- A 520px card (`#111113` dark, `#ffffff` light, 16px radius, hairline inset ring) titled "Project settings". The header reads "Unsaved changes" in mono, shows "Saving…" while Save runs, and changes to "All changes saved" once it lands. Status strings share one right-aligned grid cell and cross-fade in place, so the outgoing and incoming text never sit at different x positions. Three read-only rows: Domain, Visibility, Retention. A fourth row, "Delete project" with a muted line "Removes every deploy and the domain.", carries a small destructive "Delete", so the one red and the sm size are on show.
- Footer: primary "Save changes" (the demo target), secondary "Preview" with a leading 16-unit eye glyph, ghost "Discard". DOM order is Save, Preview, Discard. Measured with a ResizeObserver: at 380px of footer width or more they share a row, Save and Preview on the left with an 8px gap and Discard pushed right (`ml-auto`) with `-mr-4`, so its label lines up with the card's content edge. Below that, a two-column grid: Save `block` across both columns, then Preview and Discard `block` side by side. Reading order matches tab order in both layouts. On the shared row only Save may shrink (`min-w-0`), so a long custom label truncates Save while Preview and Discard keep their width.
- Sequence: the cursor glides to the lower right of Save, so its tip sits clear of the spinner and the check, lifts the button, holds a press for about 320ms (the face sinks), releases; Save goes to loading for about 1.1s, then success for 1.6s. A Tab then moves focus onto Preview and its ring shows.
- Customize: a state picked in the panel is held until another is picked. Picking one cancels any save still running. A Dark or Light theme control repaints the stage, the card and every button.

**Don't**
- No gradient fill, no glow or coloured shadow, no bounce or overshoot on press.
- Do not change the width between states.
- Do not shrink the button to a bare spinner or change its width; the spinner replaces the label inside the same box.
- Do not treat a plain or synchronous `onPress` as work in flight. Only a returned promise shows loading and success.
- Do not add a second accent colour or a decorative pill beside the button.
