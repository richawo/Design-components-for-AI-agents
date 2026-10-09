Build a minimal, warm-paper site footer in React + Tailwind CSS v4 + `motion/react`, centred on one beautifully crafted email capture. The signature: on submit, the field itself morphs (one shared layout element) from a wide pill into a 56px circle with a spinner, then out into a dark pill with a drawn check and copy that arrives word by word. Every state is designed: empty, focused, typing, typo hint, invalid, loading, success, already subscribed, error with retry.

**Layout**
- `<footer>` is the `@container`. Background `#f4f2ed`, ink `#141413`, top border ink/10%. Content max-width 1200px, gutters 20/40px, padding-top 64px → 96px at `@2xl`.
- A centred column, max-width 560px: mono kicker ("The Thursday Letter · Issue 112"), a serif title, a body line (max 46ch), then the form 36px below.
- The shell: one element, max-width 460px, 56px tall, radius 28px, white with an inset 1px ink/13% ring and a 1px soft drop shadow. Inside: the input (16px, 20px left padding) and a 44px ink submit pill ("Subscribe →", 14px medium, 20px padding).
- A message line under the shell always reserves 44px so nothing jumps; it holds the note, the typo hint, the error, or the status.
- Bottom row, 56–80px below, over an ink/10% rule: social links (RSS with a drawn feed icon, Bluesky ↗, Mastodon ↗, LinkedIn ↗; 13.5px ink/65%) on the left, legal line and Privacy/Terms (12.5px ink/50%) on the right. Stacks and centres below `@3xl`.

**Typography**
Title: Instrument Serif, `clamp(2.5rem, 1.7rem + 3.2vw, 3.9rem)`, leading 0.98, tracking −0.02em, balanced. Body: Geist 16px / 1.6 at ink/65%. Kicker and note: Geist Mono 11px uppercase, tracking .12–.16em, ink/45–50%. Success copy: 15px medium, tracking −0.01em, wraps inside the pill on narrow screens.

**Colour**
Paper `#f4f2ed`, ink `#141413`, white `#ffffff` field, error `#b42318` (ring at 60%, 4px halo at 8%, message text). No other colour.

**States and motion**
- Empty: submit disabled at 40% opacity, `cursor-not-allowed`, no hover.
- Focused: ring deepens to ink/32% plus a 4px ink/7% halo, no transition on the ring.
- Typing: the button wakes; hover darkens to `#2b2b29` and nudges the arrow 2px; press scales 0.97.
- Typo hint: common domain typos (gmial.com, gamil.com, hotmial.com, outlok.com, …) show "Did you mean sam@gmail.com?" as a button that fixes the field. It never blocks.
- Invalid: specific, kind reasons ("That’s missing an @.", "Almost: add the domain after the @.", "Email addresses can’t contain spaces.") in rose; the shell shakes x `[0, −7, 6, −4, 2, 0]` over 420ms and turns its ring rose. Editing clears it.
- Loading: the shell (`layout`, 500ms `cubic-bezier(.65,0,.35,1)`) shrinks to a 56px ink circle while the field blurs out (4px, 180ms); a spinner fades in at 320ms once the pill is round. The message reads "Adding sam@pressroom.co…". Hold at least 700ms so it never flickers.
- Success: the circle grows into an auto-width ink pill: a 40px paper badge pops in (spring 500/32) and its check draws (`pathLength`, 380ms); "You’re on the list. First issue Thursday." arrives word by word (opacity, 5px rise, 4px blur → 0; 360ms, 35ms stagger from 280ms). Below, "Sent to … · Use a different email".
- Already subscribed: same morph, "You’re already on the list. See you Thursday." Triggered when `onSubscribe` resolves `"already-subscribed"` or by the `alreadySubscribed` prop.
- Error: when `onSubscribe` rejects, the pill becomes white with a rose ring: rose dot, "Couldn’t reach our mail server.", and an ink Retry pill (its icon turns −90° on hover) that resends the same address. Below: "Nothing was saved. Edit the address".
- Message line swaps cross-fade with 6px offset and 3px blur (300ms in, 160ms out).
- Reduced motion: no shake, no blur or offsets, instant layout; opacity changes only.

**Accessibility**
Real `<form>` with `noValidate`, a visually hidden label, `type="email"`, `autocomplete="email"`, `aria-invalid` and `aria-describedby` pointing at the message line, which is `aria-live="polite"`. Focus moves to Retry on error and to the message line on success; "Use a different email" clears the field and refocuses it. 2px ink focus outline on every control, keyboard only; 44px targets.

**Don't**
- No modal, no confetti, no toast for success; the field itself is the feedback.
- No red borders that appear before the first submit, no generic "Invalid email".
- No gradient buttons or glass. No social icon grid.
