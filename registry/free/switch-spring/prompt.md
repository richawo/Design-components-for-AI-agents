Build a settings switch in React 19 + Tailwind CSS v4 + `motion/react` that feels like it has weight: the thumb stretches in the direction it travels and lands on a spring, optional glyphs sit in the track, and an async switch holds a spinner on its old position until the change is confirmed. Monochrome by default; one accent is the only colour.

**Layout**
- One row: a `label` element wraps the text and the track, so clicking anywhere on the row flips the switch. Text is a column: label, then an optional description. `labelSide="left"` puts the text first and the track at the right edge (settings-list order); `"right"` puts the track first.
- The row gap is 12px (sm), 14px (md) or 16px (lg). The text column takes the remaining width and can shrink (`min-width: 0`).
- The track is a `button` with `role="switch"`, fixed in pixels: sm 32 × 18 with a 14px thumb, md 40 × 22 with 18px, lg 52 × 30 with 24px. The thumb sits 2px in from the track edge, vertically centred. Travel is therefore `track − thumb − 4px`: 14px, 18px and 24px.
- The root is a `@container` block, full width. It has no padding of its own; spacing belongs to the list around it.

**Typography**
- Label: Geist (font-sans) 500, tracking −0.01em. 13px (sm), 14px (md), 16px (lg).
- Description: Geist 400, 12px / 12.5px / 13.5px, line-height 1.45, in the muted ink.
- Nothing is uppercase or mono inside the component; the demo's card header is the only mono text.

**Colour (dark first, one accent)**
- Tokens are set as CSS variables on the root from a `theme` prop. Dark: ink `#f4f4f5`, paper `#0b0b0c`, thumb when off `#f4f4f5`, muted `#8a8a93`. Light: ink `#18181b`, paper `#ffffff`, thumb when off `#ffffff`, muted `#71717a`.
- Track off: ink at 12% with an inset ring at 16% ink. Hover: ink at 18%.
- Track on: the fill, which is the `accent` prop or the ink when no accent is set. Hover mixes the fill 90% with white.
- Thumb on: the paper colour. Thumb off: the thumb-off colour. Thumb shadow: a 1px soft drop plus a 0.5px hairline, so it reads on any surface.
- Track glyphs: the check is paper-coloured on the fill; the cross is the ink at 45%.
- An accent equal to `#f4f4f5` is read as the theme's ink, so the default swatch stays legible in light mode.
- Disabled: the whole row at 40% opacity, `cursor-not-allowed`, no hover response.

**Motion**
- The thumb position is one motion value driven by `spring.ui`: stiffness 500, damping 40, no bounce. Reversing mid-flight is free because `animate` starts from the current position and inherits velocity.
- The stretch comes from the thumb's speed, read through `useVelocity`. Scale X is `1 + s` and scale Y is `1 − s/2`, where `s = min(|v| / (travel × 8), 1) × 0.14`. Transform origin is the trailing edge: left while the velocity is positive (moving on), right while negative (moving off). At rest `s` is 0, so the thumb is a plain circle again.
- Track colour cross-fades over 150ms ease-out. The thumb's colour cross-fades over 150ms.
- Press: the track scales to 0.97 over 150ms (enabled only), so it feels like a physical key.
- Glyphs: the check draws on (path length 0 → 1) 80ms after the thumb starts moving on, and the cross draws off as the thumb leaves; each fades to its own opacity over 200ms ease-out.
- Async pending: the thumb keeps its old position, and a 360° spinner (`animate-spin`, 1s linear) replaces nothing else. The spinner stops under `prefers-reduced-motion`. When the promise resolves, the thumb springs to the new position and the stretch plays.
- Reduced motion: position jumps, no stretch, no glyph draw, no spinner rotation; colour and opacity fades stay at 150ms.

**Async behaviour**
- `onCheckedChange(next)` runs on every flip. A returned promise makes the change wait when `async` is on: `aria-busy` is set and the thumb shows the spinner until the promise resolves; resolve and the switch lands on `next`; reject and it stays put.
- With `async` off, the switch moves immediately and a rejection puts it back (optimistic update with rollback).
- While pending, further clicks are ignored.

**Accessibility**
- `role="switch"` with `aria-checked`, a name via `aria-labelledby` pointing at the label span, and `aria-describedby` pointing at the description. When `async` is on, a visually hidden line says "Confirms with the server before it switches." and is added to `aria-describedby`.
- `aria-busy` while pending. Keyboard: Space and Enter toggle (native button). Focus-visible: a 2px outline offset 2px in the ink colour, shown instantly, keyboard only.
- Decorative glyphs and the spinner are `aria-hidden`. Touch: the whole row is the target, the track is 22px to 30px tall with the row giving a much larger hit area.

**Demo (the default export)**
- A stage that follows the theme: `#09090b` (dark) or `#f4f4f5` (light). Centred 440px card, 18px radius, a 1px inset ring at 8% white (dark) or 8% ink (light), a deep soft shadow.
- Card header: mono 11px uppercase, 0.12em tracking, muted, reading "Notifications" on the left and "<n> of 3 on" on the right. The count tweens from 0 on first view and then tallies up as each switch lands.
- Three rows separated by hairlines: "Product updates", "Weekly digest", and "Sync to devices" (async, so its thumb holds for 800ms).
- Entrance: card rises 12px out of an 8px blur over 500ms ease-out; the header at 60ms; rows from 160ms, 60ms apart. Reduced motion: opacity only, 150ms.
- The cursor flips the three switches in order, with 420ms between them, and the third holds its spinner.

**Don't**
- No sparkle or AI icons, no gradient track, no glow, no bounce past the spring, no per-row colour, no confetti. No emoji. No pill badges. No checkmark that does not draw. No separate "saving…" text (the thumb is the status).
- No width change when the spinner appears; the thumb keeps its size and the track keeps its width.
