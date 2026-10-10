Build a settings switch in React 19 + Tailwind CSS v4 + `motion/react` that feels like it has weight: the thumb stretches in the direction it travels and lands on a spring, optional glyphs sit in the track, and an async switch holds a spinner on its old position until the change is confirmed. Monochrome by default; one accent is the only colour.

**Layout**
- One row, at least 44px tall: a `label` element wraps the text and the track, so clicking anywhere on the row flips the switch. Text is a column: label, then an optional description. `labelSide="left"` puts the text first and the track at the right edge (settings-list order), with the track centred on the row. `"right"` puts the track first and aligns the row to the top, then drops whichever of the track and the label's first line is shorter by half the difference, so the track centres on the label's first line instead of floating beside a two-line block.
- The row gap is 12px (sm), 14px (md) or 16px (lg), and tightens by 4px inside a container narrower than 20rem (`@max-xs`). The text column takes the remaining width and can shrink (`min-width: 0`).
- The track is a `button` with `role="switch"`, fixed in pixels: sm 32 × 18 with a 14px thumb, md 40 × 22 with 18px, lg 52 × 30 with 24px. The thumb sits 2px in from the track edge, vertically centred. Travel is therefore `track − thumb − 4px`: 14px, 18px and 24px.
- The root is a `@container` block, full width. It has no padding of its own; spacing belongs to the list around it.

**Typography**
- Label: Geist (font-sans) 500, tracking −0.01em. 13px / 18px line (sm), 14px / 20px (md), 16px / 24px (lg).
- Description: Geist 400, 12px / 12.5px / 13.5px (12px in a narrow container), line-height 1.45, in the muted ink. A refusal message takes the same size and weight 500 in the error red, in the same grid cell.
- Nothing is uppercase or mono inside the component; the demo's card header is the only mono text.

**Colour (dark first, one accent)**
- Tokens are set as CSS variables on the root from a `theme` prop. Dark: ink `#f4f4f5`, paper `#0b0b0c`, thumb when off `#f4f4f5`, muted `#8a8a93`, error `#f87171`. Light: ink `#18181b`, paper `#ffffff`, thumb when off `#ffffff`, muted `#71717a`, error `#dc2626`. Both error reds are AA on their card.
- The track is `--sw-track` (ink at 12%) on the button, with an inset ring at 16% ink that stays at full strength in every state. Hover steps the track to 18%.
- The fill is a child span, not the track. Its width follows the thumb (see Motion), and its colour is the `accent` prop or the ink when no accent is set. Hover steps the fill 12% toward the surface colour, so it reads on white and on near-white alike.
- Hover on the track or anywhere on the row (including the label text) lifts the track or the fill. Pending and disabled take no hover or press styling.
- Thumb off: the thumb-off colour. Thumb on: the paper colour with no accent. With an accent, the on thumb is near-black on a light accent (relative luminance over 0.6) and white on a darker one. The thumb swaps between its off and on colour across the middle of its travel, never at rest.
- Thumb shadow: a 1px soft drop plus a 0.5px hairline. In the dark theme the hairline is black at 35%, so a white thumb keeps its edge on a white fill.
- Track glyphs: the check is white or near-black, whichever contrasts more on the fill; the cross is the ink at 45%.
- Disabled: the whole row at 40% opacity, `cursor-not-allowed`, no hover response.
- `accent`: one prop, used as given. The first swatch in the playground (`#f4f4f5`) means the theme's ink, so the demo passes no accent and the ink shows (near-black in the light theme).

**Motion**
- The thumb position is one motion value driven by `spring.ui`: stiffness 500, damping 40, no bounce. Reversing mid-flight is free because `animate` starts from the current position and inherits velocity.
- The stretch comes from the thumb's speed, read through `useVelocity`. Scale X is `1 + s` and scale Y is `1 − s/2`, where `s = min(|v| / (travel × 8), 1) × 0.14`. Transform origin is the trailing edge: left while the velocity is positive (moving on), right while negative (moving off). At rest `s` is 0, so the thumb is a plain circle again.
- The fill is the wake the thumb leaves behind: a span the size of the track at full strength, revealed by `clip-path: inset(0 R 0 0 round 999px)`. Its leading edge sits under the thumb's centre and eases out to the track's end over the travel (`edge = 2 + thumbX + thumb/2 + (thumb/2 + 2) × progress`), so the thumb always covers it: no translucent disc and no seam behind the thumb, and the 2px ring ahead of the thumb fills as it lands. It is hidden outright while the thumb is under 0.5px from the off end, and it is set from the position, not from `on`, so it travels with the spring.
- The on-thumb colour swaps across the middle of the travel (progress 0.44 to 0.56), in step with the spring, so the swap happens while the stretch peaks and the thumb never sits grey on grey.
- Track and fill colours cross-fade over 150ms ease-out on hover only.
- Press: the track scales to 0.97 over 150ms (scale, not transform) while the track or its label row is pressed. Enabled only.
- Glyphs: the check draws on (path length 0 → 1) 80ms after the thumb starts moving on, and the cross draws off as the thumb leaves; each fades to its own opacity over 200ms ease-out.
- Pending: the thumb keeps its old position and shows a 360° spinner (`animate-spin`, 1s linear), which stops under `prefers-reduced-motion`. When the promise resolves, the thumb springs to the new position and the stretch plays. Pending shows `cursor-progress` on the row.
- Refusal: a rejected change replaces the description with the message in red for 3.5 s or until the next attempt. The swap is a cross-fade with a 4px offset and a 3px blur over 180ms. The thumb shakes in two beats, `[0, +4, −2, 0]` px toward the side it asked for, as a 320ms ease-out tween with keyframe times `[0, 0.3, 0.65, 1]` (a spring only takes two keyframes, so four would throw); a new refusal stops the one in flight. With reduced motion the thumb dims to half and back over 150ms instead, and the message is an opacity change only.
- Reduced motion: the position and the thumb colour jump, with no stretch, no glyph draw, no spinner rotation and no shake; colour and opacity fades stay at 150ms.

**Async behaviour**
- `onCheckedChange(next)` runs on every flip. A returned promise makes the change wait when `async` is on: `aria-busy` is set and the thumb shows the spinner until the promise resolves; resolve and the switch lands on `next`; reject and it stays put. A handler that returns nothing (no thenable) lands at once, so no frame of spinner shows.
- With `async` off, the switch moves immediately and a rejection puts it back (optimistic update with rollback).
- A rejection in either mode shakes the thumb, shows the message in red in place of the description, and announces it. The default message is "Couldn't turn on <label>. Try again.", or "off" when turning off.
- While pending, further clicks are ignored.
- Controlled (`checked` set): the switch only moves when `checked` changes. `onCheckedChange` still runs, and the parent updates `checked` once the change has landed.

**Accessibility**
- `role="switch"` with `aria-checked`, a name via `aria-labelledby` pointing at the label span, and `aria-describedby` pointing at the description. When `async` is on, a visually hidden line from the `pendingHint` prop (default "Confirms with the server before it switches.") is added to `aria-describedby`, so it can be translated.
- A refused change is announced through a visually hidden `role="status"` live region (polite). The visible red line is `aria-hidden`, so the message is read once.
- `aria-busy` while pending. Keyboard: Space and Enter toggle (native button). Focus-visible: a 2px outline offset 2px in the ink colour, shown instantly, keyboard only.
- Decorative glyphs, the fill and the spinner are `aria-hidden`. Touch: the whole row is the target and is at least 44px tall, so even a label-only small switch meets the touch size.

**Demo (the default export)**
- A stage that follows the theme: `#09090b` (dark) or `#f4f4f5` (light), filling the frame. Centred 440px card, 18px radius, a 1px inset ring at 8% white (dark) or 8% ink (light), a deep soft shadow.
- Card header: mono 11px uppercase, 0.12em tracking, muted, reading "Notifications" on the left and "<n> of 3 on" on the right. The count tweens from 0 on first view and then tallies up as each switch lands; with an async row it follows the switch at once when the switch flips at once.
- Three notification rows separated by hairlines: "Product updates" (off), "Weekly digest" (on at start), and "Push to this phone" with "Registers this device for alerts." (async, so its thumb holds for 800ms). The Disabled control and any other prop passed to the demo apply to the featured (async) row, so the other rows stay usable.
- Entrance: card rises 12px out of an 8px blur over 500ms ease-out; the header at 60ms; rows from 160ms, 60ms apart. Reduced motion: opacity only, 150ms.
- The cursor hovers each label (not the track), so the track stays clear while it lands. It turns Product updates on, turns Weekly digest off (the reverse stretch and the cross drawing), then turns Push to this phone on, which holds its spinner for 800ms before it lands. The first attempt to turn push off is refused with "Couldn't turn off push for this phone. Try again." in red and a shake, so a visitor can see the refusal and retry.

**Don't**
- No sparkle or AI icons, no gradient track, no glow, no bounce past the spring, no per-row colour, no confetti. No emoji. No pill badges. No checkmark that does not draw. No separate "saving…" text (the thumb is the status).
- No width change when the spinner appears; the thumb keeps its size and the track keeps its width.
