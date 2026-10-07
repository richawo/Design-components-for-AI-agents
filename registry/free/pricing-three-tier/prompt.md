Build a three-plan pricing section in React + Tailwind CSS v4 with `motion/react`, for a fictional accounting product ("Ledgerly"). It should feel like a premium financial product: dark, exact and calm. The middle plan glows quietly rather than shouting.

**Surface**
- Section `#050506`, white text.
- A soft emerald radial glow (`rgba(52,211,153,0.16)`, ~1100×520px) centred on the top edge, with a 1px hairline across the top fading out at both ends.

**Header**
- Eyebrow: a 6px emerald dot with a glow, then "PRICING" in mono 11px, 0.18em tracking, white/45.
- Title: Geist, semibold, `clamp(2.25rem, 1.3rem + 3.6vw, 4.5rem)`, leading 1, tracking −0.05em, max ~900px wide.
- The first clause uses a white-to-white/60 vertical gradient; the second clause ("no surprises.") sits in solid white/40. Two tones, one weight. No serif and no italic.
- Below it: body copy (16px, white/60, max 52ch) on the left, and the billing toggle on the right on desktop (stacked on mobile).

**Billing toggle**
- A pill radiogroup: `white/3%` fill, `white/8%` border, inset top highlight.
- The active option is a white pill with black text and a soft white glow, sliding with a motion `layoutId` spring (stiffness 500, damping 40, no bounce). Options scale to 0.97 while pressed. Arrow keys switch it.
- Underneath: "Pay annually, get [2 months free]", where the tag is an emerald-tinted pill (`#34d399` at 12% fill, 30% ring, `#6ee7b7` text) while annual is on. On monthly it falls back to a neutral white/3% pill, and switching to annual gives it a single 6% pulse, so the saving feels earned.

**Cards** (3 columns at lg; stacked below; at md each card splits into price and features columns)
- Standard card: vertical white gradient (4.5% → 1.5%), 1px `white/8%` ring, inset top highlight, 22px radius.
- Featured card:
  - an emerald-tinted top gradient (10%), a 1px emerald ring at 28%;
  - a 1px emerald hairline across the top, a blurred emerald bloom just above the card, and a large soft emerald drop glow;
  - 16px taller than the others (negative margin at lg);
  - a small mono uppercase label top-right ("Most teams pick this") in the emerald pill style.
- Plan name: 18px, medium, then the audience line in white/50.
- Price: a small white/50 currency, a 52–68px semibold number (tracking −0.055em) that rolls digit by digit like an odometer (critically damped spring, stiffness 160, damping 25, staggered 70ms per digit), and "/ mo" in white/40. On annual, the monthly price sits struck through above "/ mo" (13px, white/30), fading in with a 4px rise and a 2px blur.
- Under the price, a billing note swaps when the toggle changes: in from 8px below with a 3px blur (300ms), out upward faster (200ms, ease-in).
- CTA: full width, 44px pill. Featured is solid white with black text and a white glow; standard is a `white/6%` glass fill with a hairline ring. Each has an arrow that nudges 3px right on hover (200ms, ease-out) and the button scales to 0.98 while pressed. The white CTA never greys on hover; its glow deepens instead.
- Features sit below a `white/8%` rule: a lead line in white/45, then 14px items in white/80, each with a fine 1.6px check (emerald on the featured plan, white/35 elsewhere) and optional mono superscript footnote markers.

**Pointer and reveal**
- Each card carries a pointer-tracked spotlight (420px radial, white 5%, emerald 8% on the featured card) and a brighter 240px arc on its 1px edge (a masked gradient), both written to CSS variables so moving the pointer never re-renders. Mouse only; they fade in over 300ms on hover.
- On first view, cards rise 18px and fade in over 600ms (ease `[0.22, 1, 0.36, 1]`), staggered 70ms. Feature rows follow at 45ms each. Once only.

**Footnotes**
- A rule, then two columns of numbered notes (mono "01"), 13px, white/45.
- Superscript markers are links to their note. Hovering or focusing a marker lights the marker and its note together (150ms).

**Accessibility**
- The section is labelled by the title. The price has an sr-only full sentence. With reduced motion, prices swap instantly, reveals are opacity-only, and nothing moves.

**Don't**
- No rotated stickers, hand-drawn arrows, serif-italic accents or neon highlighter tags.
- No three identical cards (the featured one must differ in light, not just colour).
- No gradient text in a bright hue.
