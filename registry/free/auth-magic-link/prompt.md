Build a passwordless “magic link” sign-in card in React + Tailwind CSS v4 + `motion/react` (no other dependencies; all icons and the envelope are inline SVG). One file exports `AuthMagicLink` and its props type; the default export puts it on a true-black stage. Dark by default, with a `theme` prop for a tuned light version and one `accent` prop. Enter an email, submit, and the card morphs (height animates, content cross-fades, the primary button glides into place) into “Check your inbox”: a drawn letter slides into an envelope, the flap folds shut, a seal pops on and three faint motion lines trail behind it. The card then offers “Open Gmail / Outlook / Proton” based on the address’s domain.

**Layout**
- Card `max-width: 400px`, radius 20px, `overflow: hidden`, surface + 1px inset hairline + top highlight + `0 32px 80px -32px` shadow. Padding 36/32/32 from a 384px container up, 28/24/24 below (`@container` + `@sm:`).
- The card’s height follows its content: an inner wrapper measured by ResizeObserver drives a `motion.div` height (420ms `cubic-bezier(.65,0,.35,1)`). The two views swap inside `AnimatePresence mode="popLayout"`.
- Form view: 40px brand tile (or an amber hourglass tile when expired) → heading → subtitle → optional error banner → label + 44px field → error or typo suggestion → 44px primary button → “Use a password instead” link.
- Sent view: centred 132×104 envelope → centred heading → copy capped at 34ch → primary “Open {provider}” button (or a quiet note “Look for an email from login@halyard.app” for unknown domains) → hairline → row with “← Use a different email” left and the resend control right, both 44px tall.

**Typography**
- Geist. Heading `clamp(1.375rem, 1.2rem + .6cqi, 1.5rem)`/600, tracking −0.025em. Body 14.5px/1.55 `#a0a0a8`; the address in `#ededef`/500 with `break-all`. Input 16px under 384px, 15px above. Messages 13px.

**Colour** (one `PALETTE` object for dark and light → `--ml-*` CSS variables; no inline hex in the markup)
- Monochrome first. Dark: surface `#0a0a0b`, tile `#141416`, ink `#ededef`, label `#cfcfd4`, muted `#a0a0a8`, faint `#7d7d86`, hairlines white 10% (18% hover). Light: surface `#ffffff`, tile `#f4f4f5`, ink `#18181b`, muted `#52525b`, faint `#71717a`, hairlines `#18181b` at 14%.
- One accent (`accent` prop, default = ink) fills the primary button in both views; its label is `#0a0a0b` or `#ffffff`, whichever has the higher WCAG contrast ratio against the accent (the crossover sits near relative luminance 0.18, not 0.5), and hover lays a 7% wash of the label colour over it (driven by motion's `whileHover`, not CSS `:hover`).
- Colour only for meaning: error `#ff6b5e` / text `#ff8f84` (light `#dc2626` / `#b91c1c`) with 5–7% `color-mix` washes; the expired hourglass tile in warning `#f5c451` (light `#b45309`); the “Sent again” check in `#3ddc97` (light `#15803d`).
- Envelope (dark): back `#121214`, pocket `#161618`, open flap `#1a1a1d`, closed flap `#1d1d21`, strokes 15% white, paper `#ededef` with `#a6a6ad` lines, seal in ink. Light: back `#e4e4e7`, pocket `#f4f4f5`, flap `#fafafa`, strokes 16% ink, white paper with `#a1a1aa` lines.

**Motion** (one `MOTION` object; ease-out `cubic-bezier(.22,1,.36,1)`)
- Entrance, once at 30% in view: the card rises 16px out of a 10px blur over 600ms; inside it, mark → heading → subtitle → field → button → alternate link stagger 50ms apart from 120ms (opacity, 10px rise, 6px blur clearing, 450ms). An `enter(play, delay, reduce)` helper returns the props. Don’t put `initial={false}` on the views’ `AnimatePresence`: it suppresses every block’s entrance on first render.
- Form → sent (and back): the old view exits y −8 with a 4px blur (200ms ease-in); the new view’s blocks stagger in the same way from 140ms (envelope → heading → copy → button label → footer row). The primary button shares a `layoutId` so it travels to its new position rather than re-entering.
- Envelope (about 1.2s, never blocking): the paper starts 34px above the pocket and slides in (500ms in-out, 140ms delay). The flap is one motion value `scaleY` from −1 to 1 around its top edge (420ms in-out, 620ms delay), drawn twice: a back copy visible while the value is negative (behind the paper) and a front copy while it is positive (over the pocket). The pocket’s V starts at the same height as the flap so no paper peeks through once closed. On close, the seal scales in, the envelope nudges right 7px and back, and three 10px lines to its left draw and fade (700ms, 50ms stagger). Resending replays it.
- Invalid: the field shakes once (x 0, −7, 6, −4, 2, 0 over 420ms) and the message slides down. Typo suggestions (“Did you mean ines@gmail.com?”) slide in the same way, but only after a 400ms pause in typing (or on blur), so typing straight through a typo-shaped prefix (“gmail.co” on the way to “gmail.com”) never flashes the row; the hint closes the instant it stops applying.
- Resend countdown digits roll; the control swaps wait → “Resend link” → spinner → drawn check “Sent again” → a fresh countdown.
- Reduced motion: 150ms opacity fades only; no travel, shake or fold; the envelope renders closed.
- Cleanup: every timeout (resend hold, refocus, demo latency) goes through a `useTimeouts` hook that clears on unmount; the cooldown interval and the flap tween are stopped in effect cleanups.

**Behaviour**
- Validation is reward-early, punish-late. Blur flags a bad address; typing clears an error once it’s fixed.
- Provider detection by domain: gmail/googlemail → Gmail (deep link that searches `from:(sender) in:anywhere newer_than:1h`); outlook/hotmail/live/msn → Outlook; proton.me/protonmail/pm.me → Proton; icloud/me/mac → iCloud Mail; yahoo/ymail → Yahoo Mail; Fastmail; HEY. A `providers` prop adds or overrides domains.
- Typo map for common misspellings (gmial, gmal, gamil, hotmial, outlok, yahooo, iclod, porton…).
- “Use a different email” returns to the form with the address prefilled, focused and selected.
- `expired` opens with “That link has expired”, an explanation (links work once and last 15 minutes), and the button reads “Send a new link”.
- `onSend` rejecting shows its message in an error banner and keeps the field.

**Accessibility**
- Real form with `noValidate`, `type="email"`, `autocomplete="email"`, `inputMode="email"`. `aria-invalid`/`aria-describedby` to the error or suggestion. Field errors and the banner use `role="alert"`. A polite live region announces “Sending your link…”, “Link sent to …” and resends. Provider buttons are real links (`target="_blank" rel="noopener noreferrer"`). Focus-visible: 2px ink outline offset 2px, instant. Buttons press at 0.97–0.98.

**Demo**
- A segmented control under the card (“New visit / Expired link”, with a gliding `layoutId` pill) remounts the card in either state. Any `@example.com` address fails (it can’t receive mail), so the error state is one keystroke away.

**Don’t**
- No paper-plane clichés, no confetti, no generic “Email sent!” toast, no `mailto:` button pretending to open someone’s inbox, and no hard cut between the two states.
