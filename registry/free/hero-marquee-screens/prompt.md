Build a marquee hero in React 19 + Tailwind CSS v4 + motion/react (icons from lucide-react): a tight display headline over two or three slow rows of real product screens, drawn in markup, drifting in opposite directions and fading out at every edge. The screens are the proof; the copy stays short.

**Layout**

- One `<section>` with `@container`, `overflow-hidden`, a near-black stage. Copy sits in a `max-w-[1320px]` column, padding 16px / 40px (`@3xl`) / 56px (`@6xl`) sides, 64 / 96 / 112px top.
- `align="center"` (default): eyebrow, headline, body and actions stacked and centred, headline max 15ch, body max 52ch.
- `align="left"`: from `@5xl` a two-column grid `1.45fr / 1fr`, bottom aligned: eyebrow and headline (max 14ch) on the left, body and actions on the right. Below `@5xl` everything stacks left aligned.
- Actions: a 48px solid ink pill ("Start a free trial", arrow icon) and a quiet underlined text link ("Book a 20-minute demo"), 24px apart, wrapping on phones.
- The band sits 56 / 80px under the copy: `overflow-hidden`, 16px top and 64 / 80px bottom padding, masked with two intersected gradients: horizontal `transparent → #000 11% → #000 89% → transparent` and vertical `transparent → #000 7% → #000 78% → transparent` so the last row sinks into the page.
- Rows are 14px apart (18px from `@3xl`), cards 14 / 18px apart. Every screen is designed on a 320 × 208 canvas (32px header, 176px body, 12px padding) and scaled with a container-driven variable: `--hms-s` 0.72, 0.84 at `@3xl`, 0.92 at `@6xl`. The frame is `calc(320px * var(--hms-s))` wide and the canvas inside is `scale(var(--hms-s))` from the top left, so the screens keep their internal layout at every width.
- Each row's track holds three identical sets (clone, real, clone); the set repeats its screens until it is wider than the row. The track is translated by `x − 1.5 × period`, where `period` is the set's width including its trailing gap, so it overhangs both ends (tilted rows never show a corner). Row `r` starts three screens further along than row `r − 1` and at its own phase (`period × ((r × 0.41 + 0.17) mod 1)`), so screens never line up into columns.
- A 44px round pause button sits bottom right of the section (16px in, 32px from `@3xl`), always visible.

**Screens (default content: Halyard, a freight desk for small teams)**

Frame header: an 11px sail glyph, "Halyard / Title" at 10.5px (product at 45% ink, title at 90%), a mono 9px uppercase meta note on the right. Eight bodies, all monochrome with exactly one accent element each:

1. Shipments, "128 active": table of five refs (HLY-20418 NGB → RTM In transit Thu 14:20 …); "In transit" has an accent dot, Customs a hollow ring, Delivered a grey dot.
2. HLY-20418 tracking: dot-grid SVG (8px pattern, id from `useId`), dashed full route Ningbo → Rotterdam, the first 62% in a solid accent stroke (`pathLength=1`), the vessel at that point; "MSC Aurelia · Day 23 of 37 · ETA Thu 14:20".
3. INV-3307: four line items for Kestrel Foods Ltd, total £18,420.00 in mono 17px, "Paid 3 Oct" with a check.
4. Reliability: "97.4%" at 30px, "+2.1 pts", 20 bars of on-time share with today's bar in accent.
5. Customs: four documents, three checked in ink circles, the certificate of origin pending with an accent arc, "3 of 4" bar.
6. Brightline Haulage chat: three bubbles (theirs ink 7%, yours solid ink), "Brightline is typing" with an accent dot.
7. Pickups, week 42: five day columns, today (Wed 15) topped with a 2px accent rule, slots like "06:40 FXT".
8. Quotes: three carriers for a 40′ HC Shanghai to Felixstowe; the booked one has a 1px accent inset ring and an accent "Booked" check.

**Typography**

- Headline: `font-display`, weight 600, `clamp(2.5rem, 7.6cqi, 6.4rem)`, leading 0.92, tracking −0.055em, `text-balance`.
- Eyebrow: mono 11 / 12px uppercase, tracking 0.16em, 60% ink, preceded by a 6px accent dot.
- Body: 15 / 17px, leading 1.6, 65% ink. Actions 15px medium.
- Inside screens: 10px UI, 9px mono uppercase labels (tracking 0.12em), all figures `tabular-nums`.

**Colour**

- Dark: page `#08080a`, ink `#f5f5f6`, card `#111114` (hover `#16161a`), hairline `rgba(255,255,255,0.08)` (hover 0.2), shadow `inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 48px -24px rgba(0,0,0,0.9), 0 8px 16px -8px rgba(0,0,0,0.6)`.
- Light: page `#ececea`, ink `#111113`, card `#ffffff`, hairline `rgba(17,17,19,0.08)`, a softer grey shadow.
- Accent `#ff5a1f` (international orange: a container moving right now), one prop. Every other tone is ink at an opacity.

**Motion**

- Entrance on `useInView` (20%, once): eyebrow at 0s, headline words from 0.06s, 35ms apart, body 0.24s, actions 0.32s; each rises 12px out of an 8px blur over 600ms on `cubic-bezier(0.22, 1, 0.36, 1)`. Rows then rise 24px out of an 8px blur over 750ms from 0.46s, 80ms apart.
- Each row sets off 0.45s after it lands. One `requestAnimationFrame` loop per row moves the track imperatively (no re-renders); velocity eases towards its goal with time constants of 0.8s (speeding up) and 0.3s (slowing), so nothing brakes or lurches. Even rows travel left, odd rows right; rows run at 1, 0.78 and 1.14 × `speed` (default 22px/s). Frame steps are clamped to 50ms.
- The row under a mouse pointer glides down to a fifth of its speed (never frozen); the card under the pointer lifts 4px and its hairline brightens over 200ms. The pause button eases every row to a stop and back.
- `tilt`: the stack springs (stiffness 180, damping 26) to `rotateX(24°) rotateZ(−7°) scale(1.16)` with perspective 1600px, origin 50% 35%.
- Loops stop when the band is offscreen (IntersectionObserver) or the tab is hidden.
- Reduced motion: rows are still, at their seeded phases; everything appears immediately; no pause button.

**Accessibility**

- `section` labelled by the `h1`. CTAs are real links with a 2px ink focus ring offset 4px, press scale 0.97.
- The band is `aria-hidden`; a visually hidden sentence lists the screens ("Halyard screens drifting past: shipments, hly-20418, …").
- The pause button (WCAG 2.2.2, moving content longer than 5s) is a real button whose label flips between "Pause the moving screens" and "Play the moving screens".
- Touch never triggers the hover slow-down.

**Don't**

- Screenshots or images of UI, or a different hue per screen.
- Window chrome with coloured traffic lights.
- A CSS keyframe marquee that jerks to a stop on hover, or rows moving in lockstep.
- Hard edges where the rows leave the band, or empty corners when tilted.
- Gradient text, a glow behind the headline or an "Introducing" pill.

**Text contrast**
Keep secondary text at least 65% of ink in both themes; selected, skipped and inactive content remains readable. Use outlines, status labels and icons for state instead of dimming whole content groups.
