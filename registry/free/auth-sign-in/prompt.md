Build an email-and-password sign-in card in React + Tailwind CSS v4 + `motion/react` (no other dependencies; draw every icon as inline SVG). One file exports `AuthSignIn` and its props type; the default export puts it on a true-black stage. The signature: when a field takes focus, a point of light starts where you clicked (top-left for keyboard focus), runs once around the field’s border drawing the focus ring behind it, then fades, leaving the ring settled.

**Layout**
- Card `max-width: 400px`, `#0a0a0b`, radius 20px, a 1px inset ring at 8% white, a 6% white top highlight, shadow `0 32px 80px -32px rgba(0,0,0,.9)`. Padding 36/32/32px from a 384px container up (`@container` on the root, `@sm:`), 28/24/24px below it.
- Top to bottom: a 40px rounded-11px brand tile with a two-triangle sail mark; heading (24px gap); subtitle (8px); optional banner; SSO row (28px gap); divider (24px); form (24px); sign-up line (24px).
- SSO: a grid of equal columns (Google, GitHub, Apple), 8px gaps, 44px tall, radius 11px, 3% white fill with a 9% inset ring, 16px mark + label at 13.5px/500. They fit three-up at 390px.
- Divider: two hairlines that fade in from the edges with a 10.5px mono uppercase label (tracking 0.16em, `#6e6e76`) between them.
- Fields: 13px/500 label in `#cfcfd4`, 8px above a 44px field (radius 11px, 2.5% white fill, 10% inset ring; 17% on hover). The password label row carries a “Forgot?” link on the right. Remember-me row is a 44px tap target with an 18px custom checkbox (radius 5px) whose check draws in with `pathLength`.
- Submit: 44px, full width, `#ededef` on `#0a0a0b`, radius 11px, inset highlight; pure white on hover.

**Typography**
- Geist (`font-sans`). Heading `clamp(1.375rem, 1.2rem + .6cqi, 1.5rem)`, weight 600, tracking −0.025em, leading 1.15. Subtitle 14.5px/1.55 `#a0a0a8`. Inputs 16px under 384px (no iOS zoom), 15px above. Messages 13px/1.45.

**Colour**
- Text `#ededef`, secondary `#a0a0a8`, muted `#6e6e76`. Error `#ff6b5e` (ring at 55–90%, field tint 4%), error text `#ff8f84`. Warning (caps lock, lockout) `#f5c451`. Success `#3ddc97` with `#04140c` text. One neutral family, no gradients beyond the divider hairlines.

**Motion**
- Focus light: an SVG overlay with a rounded-rect path (radius 11px, inset .75px) measured by ResizeObserver. A motion value `t` animates 0→1 over 800ms `cubic-bezier(.65,0,.35,1)`. The ring is `stroke-dasharray: t·P (P − t·P)` with `dashoffset = −start`, so it draws from the start point clockwise and wraps. The comet is six stacked dashes that all end at the head (`start + t·P`): tails 84/46/22px at 14/28/55% opacity, then a halo 16px × 8px stroke at 7%, 13px × 4.5px at 16%, and a 10px × 2.25px core at 100%. The comet fades out over the last 18%. Rest ring: white at 62% (coral when invalid). Start offset = pointer x on the top edge, minus the radius. Blur fades the ring out in 180ms.
- Invalid: the field shakes once (x: 0, −7, 6, −4, 2, 0 over 420ms) and the message slides down (height auto + y −6→0, 300ms ease-out). Reward early, punish late: typing only clears or refines an error that is already showing.
- Password reveal: the eye morphs (lids flatten to a squint, pupil shrinks, a slash draws with a matching mask gap). Dots cross-fade to text with a left-to-right wipe: a ghost input holding the old rendering sits on top, and both get complementary `mask-image` linear gradients with a 16%-wide soft edge, sweeping over 500ms.
- Submit morphs label → spinner + “Signing in…” → drawn check + “Signed in” in the same 44px box, cross-fading with an 8px offset and 3px blur. It turns green on success.
- Lockout countdown digits roll (each changed digit enters from −70% and exits to +70%).
- Card enters once: y 12→0, blur 4→0, 600ms. Reduced motion: no light travel (ring appears), no shake, no wipe, opacity-only swaps.

**States**
- Idle, hover, focus, filled, invalid per field, loading (SSO disabled at 40%, fields read-only at 60%), success, locked (amber banner, button becomes a quiet `bg-white/5` “Try again in 0:29” with a drawn lock glyph with rolling digits), caps lock (amber line under the password, from `getModifierState`), connection failure (coral banner), SSO loading (spinner replaces the clicked provider’s mark, others disabled), SSO success (check).
- `onSubmit` resolves `{ ok: true }`, `{ ok: false, reason: "invalid_credentials", attemptsLeft }`, `{ ok: false, reason: "unknown_email" }` or `{ ok: false, reason: "locked", retryAfter }`. Throwing means network failure.

**Accessibility**
- Real `form` with `noValidate`; `type="email"`, `autocomplete="username"` and `current-password`; `inputMode="email"`; `autocapitalize="none"`.
- Labels with `htmlFor`; `aria-invalid` and `aria-describedby` to each message; field errors use `role="alert"`; a polite live region announces signing in / signed in; the eye is `aria-pressed` with label “Show password” and keeps the caret in the field on pointer toggles.
- Focus-visible rings: 2px `#ededef` outline offset 2px, instant. Every button presses at 0.97–0.98.

**Demo**
- Password `correct-horse` signs in; wrong passwords count down tries; the third miss locks for 30 seconds. A mono hint under the card says so, and turns into “Reset demo” after success.

**Don’t**
- No glow around the card, no gradient buttons, no floating labels that jump, no generic grey disabled button for the lockout, no `outline-none` on buttons (it kills the focus ring in Tailwind v4).
