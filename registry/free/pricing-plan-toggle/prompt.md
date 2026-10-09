Build one pricing plan card with a billing switch above it in React + Tailwind CSS v4 + `motion/react`. Not a pricing section: a single card on a quiet black stage. The toggle is the toy; the price reacting to it is the reward.

**Layout**
- An `@container` column, max-width 420px, centred. The switch sits on top, 20px above the card.
- Card: `#0b0b0c`, radius 22px, inset hairline white/8%, top highlight white/6%, a long soft drop shadow; padding 24px (28px from `@sm`).
- Order inside: header (name + description left, save badge right), price row, billing note, seats panel, CTA, a hairline, features with checks, mono footnote.

**Billing switch**
- `radiogroup` of two radios, "Monthly" and "Annual", each min 104px wide, 36px tall, in a 4px-padded pill (`white/4%`, inset hairline white/8%). Arrow keys move between them; only the checked one is tabbable.
- The white thumb (`#f4f4f5`) is one `layoutId` element that glides on spring stiffness 500, damping 40. Active label `#0b0b0c`, inactive white/55 → white on hover. Press scale 0.97.

**The signature: slot-reel price**
- Each digit is its own reel: a strip of 0–9 repeated five times, 1.1em per cell, masked top and bottom (transparent → black 16% / 84% → transparent).
- All reels spin the same way: up when the price rises, down when it falls, by the shortest number of steps in that direction. Spring stiffness 120, damping 19 (one small landing overshoot), staggered 55ms left to right. When a reel settles it silently jumps back to the middle copy so it can spin again.
- Motion blur from the reel's own velocity: `blur(min(2.4, |v| / 9) px)` where v is digits per second, so a fast spin smears and the landing is crisp.
- Digits are keyed from the right; if the number of digits changes the new column grows in from width 0.
- Price type: Geist 600, `clamp(3.25rem, 2.6rem + 3cqi, 4rem)`, tracking −0.05em, tabular numerals; the currency is 22px white/45 top-aligned; the unit ("per seat / month") is 13px white/45 on two lines, bottom-aligned.

**Other motion**
- Save badge ("Save 20%", mono 11px uppercase, tracking 0.08em, `#9be7c0` on `#7dd3a8` at 12% with a 30% inset ring) pops in on annual with a spring (stiffness 520, damping 20, from scale 0.6, y 4px, origin right) and leaves in 140ms ease-in.
- The billing note cross-fades: in from y 8px with 3px blur over 300ms, out to y −8px in 180ms.
- Seats panel (`white/2.5%`, radius 14px, inset hairline white/6%): a stepper with 32px − and + buttons (44px hit areas, disabled at the limits at 35%) and the count rolling 10px in the direction of change. Below, "Total" and the amount, tweened over 450ms ease-out with tabular numerals; the unit "/ year" or "/ month" fades and both widths are reserved so nothing shifts.
- Feature checks (`#7dd3a8`) draw in with pathLength over 450ms, staggered 70ms, once in view.

**CTA**
- Full width, 44px, radius 11px, `#f4f4f5` with an inset top highlight; hover goes to pure white and the arrow nudges 2px; press 0.98; 2px white focus outline offset 2px.
- Loading: spinner + "Setting up your trial…" in the same box. Success: a check that draws in + "Check your inbox", back to idle after 2.6s. Labels cross-fade with a 7px offset and 3px blur.

**Accessibility**
- The visual price is `aria-hidden`; an sr-only sentence carries price, unit and note. A polite live region summarises billing, seats and total after any change. Stepper is a labelled group with labelled icon buttons; the CTA has `aria-busy` while loading and a status message.
- Reduced motion: reels jump, no blur, badge and labels fade only (≤150ms), checks are drawn already.

**Don't**
- No three-card layout, no "Most popular" ribbon, no strikethrough price, no gradient text, no glow. One accent (mint) only.
