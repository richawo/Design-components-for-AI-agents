Build a scroll-driven feature story in React + Tailwind CSS v4 with `motion/react`. On desktop, a product panel stays pinned on the left and changes state as four steps scroll past on the right. It's for a fictional invoicing app for freelancers ("Ferry"). Black and white with one accent, dark by default (`theme` prop for warm paper).

**Palette**
- Tokens per theme in one object, written to `--fs-*` variables. Dark: background `#0a0a0a`, ink `#f4f4f2`, panel `#121212`, wells `#0a0a0a`, invoice paper `#f4f4f2` with `#0a0a0a` ink. Light: background `#f6f5f2`, ink `#0a0a0a`, panel `#ffffff`, wells `#f6f5f2`, paper `#fbfaf7`.
- One `accent` prop (default `#ff8a4c`) for progress, the primary action and the money that's yours: the rail fill, reached step rings, the eyebrow and running dots, the timer button, “Send invoice”, the paid ring, the Paid timeline dot and the “Yours” pot. Everything else is ink at an opacity.

**Header**
- A mono eyebrow at 55% ink with a 6px accent dot ("HOW FERRY WORKS"), then the heading in Geist semibold (`clamp(2.5rem, 1.3rem + 4.4vw, 5.25rem)`, leading 0.95, tracking −0.055em, max 16ch).
- The second clause ("an accounts team.") sits at 45% ink. Two tones, no italic.
- An intro paragraph (16px, 65%) on the right at desktop.

**Desktop** (`@5xl` container query; root is `@container`)
- 12 columns. Left 6 columns: a `sticky top-0 h-screen` area holding the product panel, centred vertically, with "STEP 01 / 04" and the current tab name in mono under it.
- Right: the four steps, each tall enough to read (about 80vh). Each has a numbered ring marker on a vertical rail, a mono kicker at 50% ink ("01 — TRACK"), a title (32–40px semibold), a body paragraph and a mono detail line after a short rule.
- The rail fills with the accent as you scroll: `useScroll` over the steps container (offset "start 50%" to "end 50%"), smoothed by a spring (220/40).
- An IntersectionObserver picks the active step. On desktop, inactive step titles drop to 35% ink and bodies to 30%. Ring markers up to the active step take the accent.

**The panel** (all markup, 4 states crossfading in place)
1. **Track:** a ticking timer (02:14:39, colons dimmed to 35%) plus an accent pause button, three time entries and a week bar chart with today in full ink.
2. **Invoice:** an invoice document with client, project and number, line items with quantities and amounts, and a total.
3. **Paid:** an accent ring with a tick, the amount, and the invoice’s timeline (sent, opened, reminder skipped, paid).
4. **Set aside:** an incoming payment split into pots (tax, pension, yours) with animated share bars and amounts.
- The panel has tabs (Track · Invoice · Paid · Set aside) whose underline follows the active state.

**Mobile**
- No sticky. Each step shows its own panel state inline above its text, animating when it enters view.

**Choreography**
- Header: eyebrow, heading and intro rise 12px out of an 8px blur at 0 / 60 / 140ms. Each step’s copy reveals once at 25% in view. The pinned panel rises in at 220ms and its first state plays once it has.
- States cross-fade in place with a 16px offset and a 4px blur over 0.5s. Every time a state becomes active, its blocks replay in order: the container at 80ms, rows at 60ms steps (rise out of blur), figures counting up from zero out of a blur from 160ms over 0.9s, bars and pots filling from their base from 450ms over 0.8s.
- Track: the clock fast-forwards from 00:00:00 to 02:14:37, then ticks a second at a time. Invoice: the paper lands, line items stagger, the total counts, “Send invoice” rises last. Paid: the accent ring draws round, then the tick draws through it, the amount counts, the timeline staggers. Set aside: pots rise, fill, and their amounts count.
- Figures are motion values rendered as text; nothing sets React state per frame.

**Accessibility**
- Each step is a section with a heading, and the panel states are `aria-hidden` illustrations.
- With reduced motion: short fades only, instant swaps, final figures, and the rail follows scroll without a spring.

**Don't**
- No scroll-jacking or snap-scrolling, serif accents, purple gradients or images of laptops.
- No navy or cream tints, and no accent on labels, eyebrows or every bar.

**Navigation feel**
- The numbered markers on the rail are buttons: hovering grows them to 110%, pressing to 95%, and clicking glides the page so that step sits in the middle of the viewport (smooth scroll; instant under reduced motion). The panel follows on its own.
- Under the sticky panel, two small arrow buttons step back and forward (disabled at the ends, pressing to 0.9) beside the "Step 02 / 04" counter, and the step name slides in (6px, 2px blur) on every change.
- Colour transitions on headings, body and markers run at 400ms.
