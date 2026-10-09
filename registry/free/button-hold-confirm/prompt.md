Build a hold-to-confirm button for destructive actions in React + Tailwind CSS v4 + `motion/react`. A click is too cheap for "delete"; a hold is deliberate. It should feel physical: the fill follows your finger, lets go when you do, and lands with a tiny shake.

**Anatomy**
- A `button` that is a CSS grid. Every label state (idle, pending, done, error) sits invisibly in the same grid cell, so the button is as wide as its longest state and never resizes; the visible label cross-fades on top.
- Sizes: `sm` 36px tall, 9px radius, 12px padding, 13px label, 14px icon, 6px gap, with a `::before` that extends the hit area to 44px; `md` 44px tall, 11px radius, 18px padding, 14px label, 16px icon, 8px gap. Geist 500, tracking −0.01em.
- Icons are drawn inline SVG on a 16-unit grid, 1.35px strokes: trash (danger), archive box (neutral), check, alert, spinner.

**The signature: the label inverts at the fill's edge**
- The fill is a full-size layer clipped with `clip-path: inset(0 (1 − p)·100% 0 0)`, driven by one motion value `p`. Inside it sits a second copy of the label in the inverse colour, so the text changes colour exactly where the fill is, character by character.
- A hot leading edge rides `p`: a 1px line in the edge colour plus a 24px gradient trail (edge colour at 33%) behind it, hidden at 0 and 100%.

**Colour (monochrome first; the red is the one accent)**
- Every colour is mixed in CSS from two variables so one `accent` prop rebrands it: `--hc-tint` (the fill for danger, the ink for neutral) and `--hc-ink` (`#f4f4f5` dark, `#18181b` light, from a `theme` prop).
- Surface `color-mix(tint 8%, transparent)` with an inset ring at 24% (hover 12% / 36%), so it sits on any background. Label and focus outline `color-mix(tint 62%, ink)`.
- Fill: danger `#e5484d` (`#dc2626` on light), neutral the theme's ink (`#ececee` dark, `#18181b` light); the inverted label is black or white by luminance. Edge `color-mix(fill 45%, white)`.
- Focus: a 2px outline with a 2px offset (an outline, not a ring, so the gap shows whatever surface the button sits on), keyboard only.
- Tokens (PALETTE, MOTION, SIZES) live in one place at the top of the file.

**Motion**
- Press (pointer down or Space/Enter down, ignoring key repeat): scale 0.98 in 100ms, and `p` animates linearly to 1 over the remaining `(1 − p) × duration` (default 1200ms), so a re-grab continues from where the fill is.
- Release early: `p` springs back to 0 (stiffness 420, damping 40, no overshoot). Sliding more than 16px off the button, blur and pointercancel also release.
- A tap shorter than 260ms nudges the fill to 10% and back over 500ms and shows a light tooltip above ("Press and hold", 12px, `#f4f4f5` on `#0b0b0c`) for 1.7s.
- At 100%: `navigator.vibrate(12)` where available and a 340ms shake on x `[0, −3, 3, −2, 2, −1, 0]`. Then call `onConfirm`. If it returns a promise, show a spinner with "Deleting…" until it settles.
- Success: the label cross-fades to the check + "Deleted" (in 7px from below, 3px blur, 260ms; out up 7px in 160ms ease-in); the check draws in (pathLength, 340ms). After `resetAfter` (2400ms; null keeps it) the fill drains over 450ms and the label returns.
- Error: shake, the fill springs back, and the label shows the alert icon + error text for 2.6s.
- Reduced motion: the fill still tracks the hold (it is the meaning); no shake, no spring, no blur, 150ms fades.

**Accessibility**
- `aria-describedby` reads "Press and hold for 1.2 seconds to confirm."; a `role="status"` live region announces the result ("halcyon-web deleted" or the error).
- Space and Enter hold from the keyboard; the implicit click is prevented. `aria-busy` while pending. Disabled is 40% opacity and `cursor-not-allowed`.
- `touch-action: manipulation`, no text selection, no iOS callout, context menu suppressed so a long press doesn't open it.

**Demo (true black stage, greyscale: the red belongs to the buttons alone)**
- A 600px card (`#0b0b0c`, 18px radius, hairline inset ring) titled "Projects" with a mono "3 of 3" that counts up from zero on first view (tabular, blur clearing) and ticks down as rows go. Three rows: a grey two-letter monogram tile (`#18181b`, `#a1a1aa` initials, hairline), mono name, a `#8a8a93` meta line, and a `sm` button (two "Delete", one neutral "Archive"). On confirm the row collapses (height + opacity, 320ms in-out) after the "Deleted" check lands. When none are left: "Nothing left to delete." and a "Restore projects" button; restored rows stagger back in.
- Footer "Delete workspace" with a `md` "Hold to delete workspace" (1500ms) whose promise rejects to show "Detach 2 domains first". A mono keyboard hint sits under the card.
- Entrance (once at 30% in view, ease-out `[0.22, 1, 0.36, 1]`): card rises 12px out of an 8px blur (0.5s), header at 60ms, rows from 0.16s 60ms apart, footer at 0.4s, hint at 0.52s. Reduced motion: 150ms fades.
- All demo timers go through a `useTimers` hook that clears them on unmount; ids come from `useId`.

**Don't**
- No progress percentage, no countdown numbers, no confetti, no red glow, no tinted monogram tiles. No width change between states. No click-to-confirm modal.
