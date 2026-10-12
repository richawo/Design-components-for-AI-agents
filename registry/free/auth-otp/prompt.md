Build a six-digit one-time-code verification card in React + Tailwind CSS v4 + `motion/react` (no other dependencies). One file exports `AuthOtp` and its props type; the default export puts it on a true-black stage. Dark by default, with a `theme` prop for a tuned light version and one `accent` prop. Digits roll into their cells, a paste ripples across all six, wrong codes shake away cell by cell, and on success a band of light sweeps left to right before the cells slide together and fuse into a single “Verified” pill.

**Layout**
- Card `max-width: 400px`, radius 20px, surface + 1px inset hairline + top highlight + deep shadow, padding 36/32/32 from a 384px container up, 28/24/24 below (`@container` + `@sm:`).
- Top to bottom: a 40px channel tile (envelope for email, phone for SMS); heading “Check your inbox” / “Check your phone”; lead-in “Enter the 6-digit code we just sent to” followed by the destination in ink/500 and an “Edit” text button with a pencil that tilts −12° on hover; the cell row (28px gap); a reserved 42px status line; a hairline; the resend row (“Didn’t get it?” left, resend control right, 44px tall); a 12.5px footnote.
- Cells: `flex: 1`, 52px tall (56px from 384px), radius 12px, 8px gaps with a 16–20px gap between the two groups of three. Empty: 2% white fill, 9% ring. Filled: 4% fill, 16% ring.

**The input**
- One real `<input>` laid transparently over the row: `inputMode="numeric"`, `autocomplete="one-time-code"`, `pattern="[0-9]*"`, `maxLength=6`, transparent text and caret. The cells are `aria-hidden` visuals.
- The native selection always covers exactly one cell: the filled cell you’re on (`setSelectionRange(i, i+1)`, so typing replaces it) or the first empty cell (collapsed caret). Read the live `el.value` in selection callbacks, never a stale render.
- Clicking a cell puts you on it, but never past the first empty cell. Arrows, Home and End move. Backspace clears the cell you’re on, or steps back and clears when you’re on an empty one. Delete clears in place. Enter verifies a full code. Letters are rejected with a 3px nudge on the active cell.
- Paste (or SMS autofill) of a full code fills all cells with a ripple: each digit lands 45ms after the previous one and its cell lifts 4px. A partial paste inserts at the cursor.
- The last digit landing calls `onVerify(code)` automatically.

**Typography**
- Heading `clamp(1.375rem, 1.2rem + .6cqi, 1.5rem)`/600, tracking −0.025em. Body 14.5px/1.55 in the muted token. Digits Geist Mono `clamp(1.25rem, 1.05rem + 1cqi, 1.5rem)`/500, tabular. Status 13.5px. Resend 13.5px/500.

**Colour** (one `PALETTE` for dark and light → `--otp-*` CSS variables; no inline hex in the markup)
- Monochrome first. Dark: surface `#0a0a0b`, tile `#141416`, ink `#ededef`, muted `#a0a0a8`, faint `#7d7d86`; empty cells white 2% fill + 9% ring, filled 4% + 16%. Light: surface `#ffffff`, ink `#18181b`, muted `#52525b`, faint `#71717a`, cells ink 2% + 13%.
- One accent (`accent`, default = ink): the active-cell ring (80%), the caret, the editor’s Send button and Resend when it’s the only way forward (after a lockout). Labels on it are black or white by contrast.
- Meaning only: error `#ff6b5e` (ring 70%, 6% fill, digits `#ff8f84`; light `#dc2626` / `#b91c1c`). Success `#3ddc97` (ring 50%, 7% fill, digits `#c9f7e1`; light `#16a34a`): the sweep band is the success colour at 38%; the pill is 12% success mixed into the surface with a 45% ring and a 4px 6% halo.

**Motion** (one `MOTION` object; ease-out `cubic-bezier(.22,1,.36,1)`)
- Entrance, once at 30% in view: the card rises 16px out of a 10px blur (600ms); glyph → heading → destination stagger 50ms apart from 120ms (opacity, 10px rise, 6px blur clearing, 450ms); then the cells land one by one, 35ms apart, each rising 12px out of a 6px blur; then the status line, resend row and footnote.
- Active cell: a 1.5px accent ring at 80% that glides between cells with a shared `layoutId` (spring 500/40). A 2×22px accent caret blinks (1.06s, stepped) in the active empty cell, only while focused.
- Each digit settles: it enters from y 60% at scale .86 out of a 4px blur (300ms ease-out) and leaves upward. Each cell keeps a change stamp so retyping the same digit still rolls.
- Error: cells shake in sequence (x 0, −6, 5, −3, 2, 0 over 400ms, 45ms stagger) and tint with the error colour; after ~1s the digits exit upward in a 30ms stagger, focus returns to cell 1, and the message stays until you type.
- Success: (1) an 80%-wide band of success-coloured light (38%) crosses each cell in turn (340ms linear, 55ms stagger), (2) measure the cells and slide each by `barLeft + i·w − offsetLeft` so they close into one contiguous bar while inner corners square off and digits blur out (260ms in-out), (3) swap in a pill at the bar’s exact size that animates to 188×48 with radius 24 (460ms in-out), then a check draws and “Verified” fades in from x −4.
- Resend countdown digits roll; the control swaps wait → “Resend code” (arrow icon turns −45° on hover) → spinner “Sending…” → drawn check “Sent” → a fresh 30s countdown. After a lockout it becomes a solid light button.
- Reduced motion: 150ms fades only; no rolls, shakes, sweep or glide; the pill simply appears.
- Code: `useOtpField` owns the input (selection, paste merge, keys), `useCooldown` the resend timer, `useScheduler` every setTimeout and requestAnimationFrame (all cancelled on unmount), `useImperative` the keyframe shakes (stopped on unmount). Sub-components: `CodeRow`, `Cell`, `VerifiedPill`, `DestinationLine`, `DestinationEditor`, `StatusLine`, `ResendButton`.

**States**
- Empty, typing, active cell, paste ripple, verifying (cells 60%, spinner “Checking your code…”), invalid with tries left, expired (Resend unlocks immediately), locked (cells clear and dim to 40%, Resend emphasised), connection failure (code kept, Enter retries), resend sending/sent, inline destination edit (input + Send + Cancel, validated, Esc cancels, cells dim while editing), success.

**Accessibility**
- One labelled input (“6-digit verification code”) described by the destination line and the status line. Status updates use `role="status"`, errors `role="alert"`. Edit is a real button with “Edit email address”. Focus-visible: 2px ink outline offset 2px. Buttons press at 0.97.

**Demo**
- Code `314159` verifies; `000000` is expired; anything else is wrong, and three misses lock. A Copy pill under the card puts the code on the clipboard so paste can be tried. After success it becomes “Reset demo”.

**Don’t**
- No six separate inputs fighting over focus, no native caret flashing in a transparent field, no confetti or glow on success, no auto-advance that skips cells, no spinner replacing the cells.

Require an explicit verifier before enabling code entry. Missing resend and destination callbacks disable their actions, and only acknowledged host callbacks can claim a code was sent or verified. Prevent concurrent verification or resend calls, retain the code on connection failure and ignore acknowledgements after unmount. Keep all simulated callbacks in the default demo.
