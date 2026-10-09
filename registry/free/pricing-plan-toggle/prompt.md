Build one pricing plan card with a billing switch above it in React + Tailwind CSS v4 + `motion/react`. Not a pricing section: a single card on a quiet black stage. The toggle is the toy; the price reacting to it is the reward. Monochrome: one accent, on the saving badge only.

**Tokens** (one `PALETTE` object with `dark` and `light`, written to CSS variables on the root; one `T` timeline object in seconds; named springs)
- Dark: card `#0b0b0c` with an inset ink/8% hairline, an ink/6% top highlight and a long soft drop shadow; ink `#f4f4f5`; text on ink `#0b0b0c`.
- Light: card `#ffffff`, ink `#111113`, the same hairline and a soft grey shadow.
- `accent` prop, default `#7dd3a8`: the save badge's fill (12%), ring (30%) and text (`color-mix(accent 60%, ink)` so it reads on both themes). Checks, thumb, CTA and focus rings are ink.

**Layout**
- An `@container` column, max-width 420px, centred. The switch sits on top, 20px above the card. Card radius 22px, padding 24px (28px from `@sm`).
- Order inside: header (name 16px medium + description 14px ink/50, max 30ch, left; save badge right), price row, billing note, seats panel, CTA, a hairline, features with checks, mono footnote.

**Billing switch**
- `radiogroup` of two radios, "Monthly" and "Annual", each min 104px wide, 36px tall, in a 4px-padded pill (ink/4%, inset hairline ink/8%). Arrow keys move between them; only the checked one is tabbable.
- The ink thumb is one `layoutId` element on spring 500/40. Active label on-ink, inactive ink/55 → ink on hover. Press 0.97.

**The signature: slot-reel price**
- Each digit is its own reel: 0–9 repeated five times, 1.1em cells, masked top and bottom (transparent → black 16% / 84% → transparent).
- All reels spin the same way: up when the price rises, down when it falls, by the shortest number of steps in that direction, starting from wherever the reel currently is so an interrupted spin carries on. Spring 120/19 (one small landing overshoot), 55ms left to right. When a reel settles it silently jumps back to the middle copy.
- Motion blur from the reel's own velocity: `blur(min(2.4, |v| / 9) px)`.
- Digits are keyed from the right; a new column grows in from width 0.
- Price type: Geist 600, `clamp(3.25rem, 2.6rem + 3cqi, 4rem)`, tracking −0.05em, tabular; currency 22px ink/45, top-aligned; unit ("per seat" / "per month") 13px ink/45, leading 1.3, bottom-aligned.

**Entrance** (once, at 30% in view; ≈900ms)
- Every block rises 10px out of an 8px blur (500ms, ease `[0.22, 1, 0.36, 1]`), in reading order: switch 0s, card 0.06s (16px, 600ms), header 0.12s, price row 0.16s, note 0.2s, seats panel 0.24s, CTA 0.28s, the divider draws left to right at 0.32s, feature rows from 0.36s 45ms apart, footnote 0.62s.
- Figures count up from zero: before the card is in view the price reads 0, so the reels are born on zero and spin up to the price as the price row lands, and the total counts from 0 at 0.32s.
- Each check draws its path (400ms) 60ms after its row lands. The save badge springs in last (0.42s).
- Reduced motion: one 150ms fade for everything, figures set instantly, no blur, checks already drawn.

**Other motion**
- Save badge (mono 11px uppercase, tracking 0.08em) pops in on annual from scale 0.6, y 4px and a 4px blur (spring 520/20, origin right) and leaves in 140ms ease-in.
- Billing note cross-fades: in from y 8px with 3px blur over 300ms, out to y −8px in 180ms. Both notes sit invisibly in the same grid cell so the block never jumps.
- Seats panel (ink/2.5%, radius 14px, inset ink/6%): a stepper with 32px − and + buttons (44px hit areas, disabled at the limits at 35%) and the count rolling 10px in the direction of change. The total is a motion value written straight to the DOM (no re-render), tweened over 450ms with a velocity blur up to 1.6px; "/ year" or "/ month" fades and both widths are reserved.

**CTA**
- Full width, 44px, radius 11px, ink with on-ink text and an inset top highlight; hover ink/90 and the arrow nudges 2px; press 0.98; 2px ink focus outline offset 2px.
- Loading: spinner + "Setting up your trial…" in the same box. Success: a drawn check + "Check your inbox", back to idle after 2.6s (timer cleared on unmount). Labels cross-fade with a 7px offset and 3px blur.

**Accessibility**
- The visual price is `aria-hidden`; an sr-only sentence carries price, unit and note. A polite live region summarises billing, seats and total after any change. Stepper is a labelled group with labelled icon buttons; the CTA has `aria-busy` while loading and a status message.

**Don't**
- No three-card layout, "Most popular" ribbon, strikethrough price, gradient text or glow.
- No accent on the checks or anywhere but the save badge.
- No per-frame React state for the counting figures.
