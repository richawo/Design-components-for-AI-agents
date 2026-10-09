Build a minimal site footer in React + Tailwind CSS v4 + `motion/react`, centred on one beautifully crafted email capture. Dark by default (near-black), with a warm-paper light theme from a `theme` prop. The signature: on submit, the field itself morphs (one shared layout element) from a wide pill into a 56px circle with a spinner, then out into an inverted pill with a drawn check and copy that arrives word by word. Every state is designed: empty, focused, typing, typo hint, invalid, loading, success, already subscribed, error with retry. The footer reveals once as it scrolls into view.

**Layout**
- `<footer>` is the `@container`. Content max-width 1200px, gutters 20/40px, padding-top 64px → 96px at `@2xl`. A 1px ink/10% rule spans the top edge.
- A centred column, max-width 560px: mono kicker ("The Thursday Letter · Issue 112"), a serif title, a body line (max 46ch), then the form 36px below.
- The shell: one element, max-width 460px, 56px tall, radius 28px, field-coloured with an inset 1px ink/13% ring and a 1px soft drop shadow. Inside: the input (16px, 20px left padding) and a 44px ink submit pill ("Subscribe →", 14px medium, 20px padding, text in the background colour).
- A message line under the shell always reserves 44px so nothing jumps; it holds the note, the typo hint, the error, or the status.
- Bottom row, 56–80px below, over an ink/10% rule: social links (RSS with a drawn feed icon, Bluesky ↗, Mastodon ↗, LinkedIn ↗; 13.5px ink/65%) on the left, legal line and Privacy/Terms (12.5px ink/55%) on the right. Stacks and centres below `@4xl`.

**Typography**
Title: Instrument Serif, `clamp(2.5rem, 1.7rem + 3.2cqi, 3.9rem)`, leading 0.98, tracking −0.02em, balanced. Body: Geist 16px / 1.6 at ink/65%. Kicker and note: Geist Mono 11px uppercase, tracking .12–.16em, ink/50–55%. Reader count in tabular figures. Success copy: 15px medium, tracking −0.01em, wraps inside the pill on narrow screens.

**Colour (one palette object, exposed as CSS variables)**
- Dark (default): background `#0a0a0a`, ink `#f4f4f2`, field `#141414`, solid hover `#dcdcd8`, error `#f97066`.
- Light: paper `#f4f2ed`, ink `#141413`, field `#ffffff`, solid hover `#2b2b29`, error `#b42318`.
- Monochrome otherwise: loading and success simply invert the shell to the ink colour. Error is the only hue (ring at 60%, 4px halo at 12%, dot and message text).

**Entrance (once, when a quarter of each block is visible)**
- Two blocks share one timeline; a block scrolled to later starts at once instead of waiting out its slot. Blocks rise 12px out of an 8px blur over 600ms `cubic-bezier(0.22, 1, 0.36, 1)`.
- Capture block: top rule draws from the centre (scaleX, 800ms) at 0 → kicker 60ms → title word by word from 120ms, 35ms apart → body 300ms → shell 380ms → note 460ms → the reader count counts 0 → 4,812 from 620ms over 700ms, sharpening out of a 3px blur as it lands. The count is a motion value owned by the footer, so the note never recounts when it remounts.
- Bottom row (slot 500ms): its rule draws, socials stagger in 40ms apart, the legal line lands last.

**States and motion**
- Empty: submit disabled at 40% opacity, `cursor-not-allowed`, no hover.
- Focused: ring deepens to ink/34% plus a 4px ink/8% halo, no transition on the ring.
- Typing: the button wakes; hover lightens/darkens one step and nudges the arrow 2px; press scales 0.97.
- Typo hint: common domain typos (gmial.com, gamil.com, hotmial.com, outlok.com, …) show "Did you mean sam@gmail.com?" as a button that fixes the field. It never blocks.
- Invalid: specific, kind reasons ("That’s missing an @.", "Almost: add the domain after the @.", "Email addresses can’t contain spaces.") in the error colour; the shell shakes x `[0, −7, 6, −4, 2, 0]` over 420ms. Editing clears it.
- Loading: the shell (`layout`, 500ms `cubic-bezier(.65,0,.35,1)`) shrinks to a 56px ink circle while the field blurs out (4px, 180ms); a spinner fades in at 320ms once the pill is round. The message reads "Adding sam@pressroom.co…". Hold at least 700ms so it never flickers.
- Success: the circle grows into an auto-width ink pill: a 40px badge in the background colour pops in (spring 500/32) and its check draws (`pathLength`, 380ms); "You’re on the list. First issue Thursday." arrives word by word (opacity, 5px rise, 4px blur → 0; 360ms, 35ms stagger from 280ms; the spaces sit outside the inline-block words). Below, "Sent to … · Use a different email".
- Already subscribed: same morph, "You’re already on the list. See you Thursday." Triggered when `onSubscribe` resolves `"already-subscribed"` or by the `alreadySubscribed` prop.
- Error: when `onSubscribe` rejects, the pill returns to the field colour with an error ring: dot, "Couldn’t reach our mail server.", and an ink Retry pill (its icon turns −90° on hover) that resends the same address. Below: "Nothing was saved. Edit the address".
- Message line swaps cross-fade with 6px offset and 3px blur (300ms in, 160ms out).
- Reduced motion: every block fades in 150ms, the count is set instantly; no shake, blur or offsets; instant layout.

**Code**
Tokens (palette, timeline `T`, easing) in one place; `useReveal` (scroll reveal with the shared clock), `useCountUp` (motion value) and `useSleep` (timeouts cleared on unmount) hooks; `Capture`, `BottomRow`, `Note`, `MorphText`, `CheckBadge` sub-components. No per-frame React state.

**Accessibility**
Real `<form>` with `noValidate`, a visually hidden label, `type="email"`, `autocomplete="email"`, `aria-invalid` and `aria-describedby` pointing at the message line, which is `aria-live="polite"`. The title is read once from an sr-only copy (the staggered words are `aria-hidden`). Focus moves to Retry on error and to the message line on success; "Use a different email" clears the field and refocuses it once it is back. 2px ink focus outline on every control, keyboard only; 44px targets.

**Don't**
- No modal, no confetti, no toast for success; the field itself is the feedback.
- No red borders before the first submit, no generic "Invalid email".
- No accent colour, gradient buttons, glow or glass. No social icon grid.
