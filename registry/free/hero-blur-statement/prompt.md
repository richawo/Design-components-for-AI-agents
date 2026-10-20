Build a typographic statement hero in React + Tailwind CSS v4 with `motion/react`. A studio says one sentence, very large, on grainy true black, and the client name inside the sentence keeps changing: the name blurs and rolls out, the next one rolls in, and the slot it lives in springs to the new word’s width so the rest of the line glides along. Confident, quiet, typographic. No imagery, no colour: dark by default, with a `theme="light"` paper variant.

**Layout**
- `section` on `#000`, `overflow-hidden`. Inner wrapper is the `@container`: `max-w-[1440px]`, `min-h-[clamp(640px,100svh,980px)]`, padding 20/32/56px sides, flex column.
- Top row: mono eyebrow left, mono status right (with a 6px dot at white/70 and a 3px white/8% halo). Wraps on phones.
- The statement sits low (`flex-1 justify-end`), then a hairline (`border-white/10`) and a bottom row: CTAs left, rotation control right. The bottom row stacks below `@4xl` (56rem).

**The sentence**
- Built from three props: `lead` (“We design products for”), `nouns` (`{ word, note }[]`) and `tail` (“that people\nopen on purpose.”).
- Fixed lines so nothing re-wraps while the slot springs: a `<br>` after the lead; the slot and the first tail line share a line; `\n` in the tail breaks only at `@3xl`+. Below `@3xl` the name gets a line of its own.
- Lead words: display (Geist) medium, `clamp(2.9rem, 0.6rem + 7.6cqw, 8.75rem)`, leading 0.96, tracking −0.058em, `#f5f5f4`. Tail words use 38% ink in dark and 50% in light.
- The name: Instrument Serif italic at 1.08em, leading 0.89, tracking −0.02em, full white. Contrast between grotesk and serif is the point.

**The slot**
- An inline-block whose `width` is a spring (stiffness 260, damping 26, mass 0.9). Widths come from an invisible absolutely-positioned measurer holding every name in the slot’s exact font (+0.03em for the italic overhang); re-measure on h1 resize and `document.fonts.ready`. First measure jumps, later ones spring.
- Inside: an invisible copy of the current name gives the box its baseline; the visible name is absolutely positioned on top, in `AnimatePresence mode="popLayout"`.
- Enter: from y 0.32em, blur 10px, opacity 0 → 0, 520ms ease-out `[0.22,1,0.36,1]`. Exit: to y −0.32em, blur 10px, opacity 0, 340ms ease-in.

**Rotation clock**
- One rAF clock drives the name and a 32–40px hairline progress bar beside the counter (scaleX 0→1). Interval 2600ms; the first name holds an extra 900ms during the entrance. Pause while hovering the h1 (mouse only), while held by the control, offscreen (IntersectionObserver) and in hidden tabs; the bar freezes with it.
- Control (a real `button`, min-h 44px): ring icon (pause ↔ play), `01 / 06` in tabular mono (ink/80, total at 55% ink in dark and 60% in light), the progress hairline, and the word's `note`, which cross-fades with a 6px offset and 3px blur. `aria-pressed` reflects the hold. Pressing play steps straight to the next word and gives it a full hold, so resuming answers at once.

**Entrance (one `T` timeline object, seconds)**
- Top row: eyebrow at 0, status at 0.06, each rising 10px out of an 8px blur (600ms).
- Every word of the sentence blurs in, in reading order (lead, the name slot, then the tail): opacity 0, blur 12px, y 0.08em → clear, 750ms ease-out, 40ms stagger from 0.12.
- Bottom row: the hairline draws from the left (scaleX, 800ms) at 0.50, then primary 0.58, secondary 0.64 and the rotation control 0.70, each rising out of a blur.

**Buttons**
- Primary: at least 48px ink pill, page-coloured 15px medium text, arrow nudges 2px right on hover, bg → the name colour (pure white or black). Secondary: at least 48px pill with an inset ink/15 ring, text ink/70 → ink, ring → 25%, bg + 4% ink on hover. Both press to 0.97 in 75ms, focus ring 2px white offset 4px. Below `@md`, stack the actions at full width and allow labels to wrap. Above it, place them inline.

**Colour and theme**
- Tokens in one `PALETTE` object, exposed as CSS variables. Dark: page `#000`, ink `#f5f5f4`, name `#fff`. Light: page `#f4f3ef`, ink `#0c0c0b`, name `#000`. Tail words use 38% ink in dark and 50% in light. Small metadata and counter totals use 55% in dark and 60% in light. Hairlines and rings use 10/15% ink. No accent colour anywhere.

**Code**
- Small parts: `TopRow`, `Statement` (with `Words` and `NameSlot`), `Footer`, `RotationControl`, `ControlGlyph`; hooks `useRotation` (rAF clock, pause, offscreen, returns index + step) and `useSlotWidth` (measurer → spring, ResizeObserver, fonts.ready). Named constants for the first-name hold (900ms) and the frame clamp (250ms).

**Grain**
- Inline SVG `feTurbulence` (fractalNoise, baseFrequency 0.92, 3 octaves, desaturated) as a 180px tiled background at opacity 0.07, plus a 3.5% white radial glow from the top left. Static.

**Reduced motion**
- Follow preference changes while mounted. Cancel existing entrance delays and immediately clear transforms and blur, then finish a 150ms opacity fade. Retire outgoing word/note nodes, jump the measured width and retain the focused control. Automatic rotation stops and the progress bar is hidden. The control becomes “Show the next word”; each press advances with a short fade. Normal controls say “Pause word rotation” and “Resume word rotation”, so the labels also fit verbs supplied by a host.

**Accessibility**
- The h1 contains an `sr-only` sentence listing every name; the animated copy is `aria-hidden`. The rotation can be paused (WCAG 2.2.2). Focus rings (2px ink) are visible on all three controls.

**Don’t**
- No gradient text, no typewriter caret, no letter-by-letter scramble, no cursor follower. Don’t let the line re-wrap as the name changes, and don’t animate the grain.

Use `dir="auto"` on animated sentences and their associated body or feedback text. English fallback keeps its word order on RTL pages, and Arabic copy keeps its reading order on LTR pages. Navigation and control placement retain the host layout direction.
