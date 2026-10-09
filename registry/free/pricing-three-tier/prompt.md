Build a three-plan pricing component in React + Tailwind CSS v4 with `motion/react`, for a fictional accounting product. It is the pricing alone: a billing toggle, three plan cards and their fine print. No eyebrow, headline or marketing copy above it. Dark, exact, monochrome; the recommended plan is marked by light and a single accent, never a colour wash.

**Tokens** (one `PALETTE` object with `dark` and `light`, written to CSS variables on the root; no inline hex in class names)
- Dark: page `#08080a`, card `#0e0e10`, lifted card `#151518`, ink `#f4f4f5`, text on ink `#08080a`, hairlines ink at 7–8%.
- Light: page `#f4f4f5`, card `#fafafa`, lifted card `#ffffff`, ink `#111113`; same structure, shadows in ink at low alpha.
- `accent` prop, default `#34d399`, used in exactly three places: the featured card's top hairline, the dot in its label, and the "2 months free" pill once annual billing is on. Checks, CTAs, toggle and focus rings are ink.
- One `T` timeline object (seconds) and named eases: out `[0.22, 1, 0.36, 1]`, in `[0.4, 0, 1, 1]`, `spring.ui` 500/40.

**Layout**
- `@container` root, max 1280px, padding 20/32/48px. The toggle row is centred: a radiogroup pill and, beside it (under it below `@xl`), "Pay annually, get [2 months free]".
- Cards: stacked; from `@2xl` each card splits into price | features columns with a vertical hairline; from `@5xl` three columns, the featured card 16px taller top and bottom with more padding.
- Card: 20px radius, 28–32px padding. Standard card `card` with an inset top highlight and a 1px ring. Featured card is *lifted*: the lighter `lifted` surface, a brighter ring, a deep two-stage drop shadow, a soft ink-at-6% radial light falling from its top edge, and a 1px accent hairline across the top that fades out at both ends.
- Inside: name (18px medium) with the featured label to its right (mono 10px uppercase, 0.12em, ink at 6% fill, accent dot), audience (14px, ink/50), price row, billing note, full-width 44px CTA, a hairline, the lead line (13px, ink/45) and features (14px, ink/80) with 1.6px checks (ink on the featured card, ink/40 elsewhere) and mono superscript footnote markers.
- Footnotes: a hairline, then two columns of numbered notes (mono "01"), 13px ink/45.

**Price: a mechanical odometer driven by one motion value**
- Each price is one `useMotionValue`. On first view it counts up from 0; on every toggle it tweens from wherever it is to the new price (500ms ease-out), so a double toggle reverses mid-roll.
- The number renders as digit columns (0–9 plus a trailing 0, 1.1em cells, top/bottom mask). The units column turns with the value; each higher column moves only while the column below rolls 9 → 0, like a real counter. Leading columns fold to zero width while the number is too small to need them.
- A blur from the value's velocity (`min(2.2, |v| / 14)` px) smears a fast roll and leaves the landed number crisp. Tabular numerals, 52–68px semibold, tracking −0.055em; currency 22px ink/50; on annual the monthly price sits struck through above "/ mo".
- The billing note swaps in from 8px below with a 3px blur (300ms), out upward (200ms, ease-in).

**Entrance** (once per card at 25% visible; ≈900ms in total)
- Toggle row rises 12px from an 8px blur.
- Cards rise 20px from an 8px blur over 650ms, 70ms apart, left to right; stacked on a phone, each card triggers as it scrolls in.
- Inside each card, top to bottom: header (+80ms), price (+120ms, count over 650ms), note, CTA, the divider draws left to right, then feature rows rise one by one 35ms apart, each check drawing its path (360ms) just after its row lands. The featured accent hairline draws from the centre last.
- Footnotes rise once they are in view.
- Reduced motion: one 150ms fade for everything; prices set instantly; no blur.

**Interaction**
- Toggle: the ink thumb is one `layoutId` element on `spring.ui`; arrow keys switch; press 0.97. The saving pill pulses once (6%) when annual is chosen.
- Cards carry a neutral pointer-tracked spotlight (420px, ink at 5%) and a brighter 240px arc on the 1px edge (masked gradient), written to CSS variables so the pointer never re-renders. Mouse only.
- CTA: featured is solid ink with page-coloured text; the others are ink at 5% with a hairline ring. Arrow nudges 2px on hover; press 0.98; 2px ink focus ring, offset 2px.
- Hovering or focusing a footnote marker lights the marker and its note together (150ms).

**Accessibility**
- Section labelled "Pricing plans"; each card an `article` labelled by plan. The visual price is `aria-hidden`; an sr-only sentence carries price and billing note. Radiogroup with roving tabindex. Footnote markers are links to their note.

**Don't**
- No headline, eyebrow or marketing copy inside the component.
- No emerald glow, tinted gradient on the featured card, gradient text or coloured checks.
- No three identical cards: the featured one differs in light and lift, not hue.
