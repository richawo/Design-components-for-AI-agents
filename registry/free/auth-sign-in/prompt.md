Build an email-and-password sign-in card in React + Tailwind CSS v4 + `motion/react` (no other dependencies; draw every icon as inline SVG). One file exports `AuthSignIn` and its props type; the default export puts it on a true-black stage. The signature: when a field takes focus, a point of light starts where you clicked (top-left for keyboard focus), runs once around the field’s border drawing the focus ring behind it, then fades, leaving the ring settled. Dark by default, with a `theme` prop for a tuned light version and one `accent` prop.

**Layout**
- Card `max-width: 400px`, radius 20px, surface + a 1px inset hairline + a top highlight + shadow `0 32px 80px -32px rgba(0,0,0,.9)`. Padding 36/32/32px from a 384px container up (`@container` on the root, `@sm:`), 28/24/24px below it.
- Top to bottom: a 40px rounded-11px brand tile with a two-triangle sail mark; heading (24px gap); subtitle (8px); optional banner; SSO row (28px gap); divider (24px); form (24px); sign-up line (24px).
- SSO: a grid of equal columns (Google, GitHub, Apple), 8px gaps, 44px tall, radius 11px, faint field fill with a hairline inset ring, 16px mark + label at 13.5px/500. They fit three-up at 390px.
- Divider: two hairlines fading in from the edges with a 10.5px mono uppercase label (tracking 0.16em) between them.
- Fields: 13px/500 label 8px above a 44px field (radius 11px, faint fill, hairline inset ring that strengthens on hover). The password label row carries a “Forgot?” link. Remember-me row is a 44px tap target with an 18px custom checkbox (radius 5px) whose check draws in with `pathLength`.
- Submit: 44px, full width, radius 11px, accent fill with the black-or-white text that reads on it; hover lays a 7% wash of the text colour over it.
- Split it like a senior engineer would: `useTimeouts` (every setTimeout cleared on unmount), `useLockout` (countdown that re-renders once a second), `useShake`, `useBox` (ResizeObserver), and sub-components `Banner`, `SsoRow`, `Divider`, `EmailField`, `PasswordField`, `FieldShell`, `FocusLight`, `PasswordInput`, `RevealButton`, `Checkbox`, `SubmitButton`.

**Typography**
- Geist (`font-sans`). Heading `clamp(1.375rem, 1.2rem + .6cqi, 1.5rem)`, weight 600, tracking −0.025em, leading 1.15. Subtitle 14.5px/1.55. Inputs 16px under 384px (no iOS zoom), 15px above. Messages 13px/1.45. Countdown digits tabular.

**Colour** (one `PALETTE` object → `--si-*` CSS variables on the root)
- Monochrome first. Dark: surface `#0a0a0b`, tile `#141416`, ink `#ededef`, label `#cfcfd4`, muted `#a0a0a8`, faint `#7d7d86` (AA on the surface), placeholder `#5c5c64`, hairlines white at 10% (18% hover), settled focus ring white 62%.
- Light: surface `#ffffff`, tile `#f4f4f5`, ink `#18181b`, label `#3f3f46`, muted `#52525b`, faint `#71717a`, hairlines `#18181b` at 14% (26% hover), focus ring 70%.
- One accent (`accent` prop, default = ink): the submit button and the checked box. Nothing else is coloured except meaning: error `#ff6b5e` / text `#ff8f84` (light `#dc2626` / `#b91c1c`), warning for caps lock and lockout `#f5c451` (light `#b45309`). Washes are `color-mix()` of those at 5–8%. Provider logos keep their brand colours (Google’s four); GitHub and Apple marks take the ink. Success is not green: the button keeps its accent and draws a check.

**Motion** (one `MOTION` object; ease-out `cubic-bezier(.22,1,.36,1)`)
- Entrance, once at 30% in view: the card rises 16px out of a 10px blur over 600ms. Inside it, blocks stagger in reading order 45ms apart from 120ms: mark → heading → subtitle → SSO buttons (30ms apart) → divider (its hairlines draw outward from the label with `scaleX`) → email → password → remember → submit → sign-up line. Each block: opacity, 10px rise, 6px blur clearing, 450ms. Whole sequence ≈ 900ms. An `enter(play, delay, reduce)` helper returns the props; `transitionEnd: { filter: "none" }` so nothing stays filtered.
- Focus light: an SVG overlay with a rounded-rect path (radius 11px, inset .75px) measured by ResizeObserver. A motion value `t` animates 0→1 over 800ms `cubic-bezier(.65,0,.35,1)`. The ring is `stroke-dasharray: t·P (P − t·P)` with `dashoffset = −start`. The comet is six stacked dashes ending at the head (`start + t·P`): tails 84/46/22px at 14/28/55% opacity, halo 16px × 8px stroke at 7%, 13px × 4.5px at 16%, and a 10px × 2.25px core at 100%; it fades over the last 18%. All of it is `useTransform`, no React render per frame.
- Invalid: the field shakes once (x: 0, −7, 6, −4, 2, 0 over 420ms) and the message slides down (height auto + y −6→0, 300ms). Reward early, punish late: typing only clears or refines an error that is already showing.
- Password reveal: the eye morphs (lids flatten, pupil shrinks, a slash draws with a matching mask gap, 320ms). Dots cross-fade to text with a left-to-right wipe: a ghost input holding the old rendering sits on top and both get complementary `mask-image` gradients with a 16% soft edge, over 500ms.
- Submit morphs label → spinner + “Signing in…” → drawn check + “Signed in” inside the same 44px box (8px offset, 3px blur cross-fade, 220ms). `onSuccess` fires 700ms later.
- Lockout countdown digits roll (each changed digit enters from −70% and exits to +70%).
- Reduced motion: 150ms fades only, the ring appears without travel, no shake, no wipe.

**States**
- Idle, hover, focus, filled, invalid per field, loading (SSO disabled at 40%, fields read-only at 60%), success, locked (warning banner; the button becomes a quiet “Try again in 0:29” with a lock glyph and rolling digits), caps lock (warning line under the password, from `getModifierState`), connection failure (error banner), SSO loading (spinner replaces the clicked mark, others disabled), SSO success (drawn check in ink).
- `onSubmit` resolves `{ ok: true }`, `{ ok: false, reason: "invalid_credentials", attemptsLeft }`, `{ ok: false, reason: "unknown_email" }` or `{ ok: false, reason: "locked", retryAfter }`. Throwing means network failure.

**Accessibility**
- Real `form` with `noValidate`; `type="email"`, `autocomplete="username"` and `current-password`; `inputMode="email"`; `autocapitalize="none"`.
- Labels with `htmlFor`; `aria-invalid` and `aria-describedby` to each message; field errors use `role="alert"`; a polite live region announces signing in / signed in / lock lifted; the eye is `aria-pressed` with label “Show password” and keeps the caret in the field on pointer toggles.
- Focus-visible rings: 2px ink outline offset 2px, instant. Every button presses at 0.97–0.98.

**Demo**
- Password `correct-horse` signs in; wrong passwords count down tries; the third miss locks for 30 seconds. A mono hint under the card says so, and turns into “Reset demo” after success. Its fake latency uses the same cleaned-up timeouts.

**Don’t**
- No glow around the card, no gradient buttons, no green success fill, no floating labels that jump, no generic grey disabled button for the lockout, no `outline-none` on buttons (it kills the focus ring in Tailwind v4), no inline hex outside the palette, no setTimeout left running after unmount.
