Build a three-tier pricing section in React + Tailwind CSS v4 with `motion/react`, for a fictional accounting tool called Ledgerly. It should feel calm, exact and a little dry-witted, like a good accountant: light stone neutrals, one inverted dark plan, and prices that roll like an odometer when the billing period changes.

**Layout**
- Background `#f3f1ec`, ink `#1c1a17`. Container `max-w-7xl`, padding 20/32/48px, 64–96px top and bottom.
- Header, left-aligned: a mono eyebrow ("Pricing"), then a two-line headline (max ~1040px, `text-balance`) — "Priced like a good accountant: *no surprises.*" Below it, a row: body copy left (max 52ch) and the billing toggle right-aligned (stacked under the body below `lg`).
- Plans: a 3-column grid at `lg` with 16px gaps; stacked with 32px gaps below that. Each plan is a card with 22px radius and 28–32px padding.
  - Regular cards: `#faf9f6` with a 1px border at 10% ink.
  - The featured (middle) card is inverted — `#1c1a17` with stone text — and slightly taller: `-my-5` at `lg` plus extra padding (36px sides, 48px top/bottom) and a soft long shadow `0 30px 60px -30px rgba(28,26,23,.55)`.
  - A lime sticker (`#d7f25c`) reading "Most teams pick this" hangs over the featured card's top edge, rotated −2.5°, with a 2px hard ink drop shadow and a tiny four-point star.
- Card anatomy: plan name (display 26px semibold) → one-line audience (14px, 60% ink) → price → billing note → CTA → 1px rule → lead line ("Everything in Sole, plus:") → feature list.
- At `md` (stacked, wide cards) each card splits into two columns: name, price and CTA left; features right, with a vertical rule instead of the horizontal one. At `lg` it returns to a single column.
- Footnotes: a 1px rule, then a 2-column ordered list of numbered notes (mono numbers "01", "02"), 13px at 60% ink. Features that need a caveat carry a matching mono superscript.

**Typography**
- Headline: display, 700, `clamp(2.4rem, 1.3rem + 4.4vw, 5.25rem)`, line-height 0.95, tracking −0.045em. The ending is Instrument Serif italic, 400, tracking −0.02em.
- Price: display, 600, `clamp(3.6rem, 2.8rem + 2.4vw, 4.75rem)`, line-height 1, tracking −0.05em, tabular numerals. Currency symbol 22px at 70% opacity, top-aligned; "/ mo" 15px at 55%, bottom-aligned.
- Body 16–17px, leading relaxed. Features 15px (14px at `md`), leading snug.

**Colour**
- Stone `#f3f1ec` page, `#faf9f6` cards, `#e8e5de` toggle track, ink `#1c1a17`.
- Lime `#d7f25c` is the only accent: sticker, featured CTA, featured check marks, footnote markers in the dark card and the "2 months free" highlight.

**Billing toggle**
- A pill-shaped radiogroup (track `#e8e5de`, 1px border), two 44px-tall buttons, "Monthly" and "Annual". An ink pill slides behind the active one using a shared `layoutId` (spring: stiffness 420, damping 36), scoped with `LayoutGroup id={useId()}` so two instances don't fight.
- Under it: a small hand-drawn arrow and "Pay annually, get **2 months free**", the saving in a lime highlight. Annual price = monthly × 10 ⁄ 12.

**Motion**
- Prices are odometers: each digit is a 0–9 column inside a 1.1em overflow-hidden window, animated to `y: -digit × 1.1em` with a spring (stiffness 140, damping 20), staggered 70ms left to right. Key digits from the right so units stay units. A 10% top/bottom mask softens the window edges.
- The billing note ("$360 billed once a year" ↔ "Billed monthly, cancel anytime") slides up 14px and fades, 350ms, ease [0.2, 0.8, 0.2, 1].
- CTAs lift 2px on hover; the arrow chip nudges right.
- Reduced motion: no springs or slides; values swap instantly.

**Check marks**
- Custom SVG: an 18px rounded square (lime in the featured card, 7% ink elsewhere) with a slightly hand-drawn ink tick — not a library check icon.

**Accessibility**
- The section is labelled by its heading. Each card is an `article` named after its plan.
- The toggle is `role="radiogroup"` with `role="radio"` buttons, `aria-checked`, roving tabindex and arrow-key switching.
- The odometer is `aria-hidden`; an `sr-only` span reads "$30 per month, $360 billed once a year".
- Visible `focus-visible` outlines on the toggle and CTAs. All text meets AA.

**Don't**
- No gradient "popular" border, no glow and no "Best value!" badge in a rounded rectangle.
- Don't make all three cards identical with only the button colour changed.
- No literal checkmark emoji or icon-font ticks, no crossed-out features on the cheap plan.
- Don't animate the whole number as a fade; the digit roll is the idea.
