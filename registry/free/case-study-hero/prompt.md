Build a portfolio case-study header in React + Tailwind CSS (v4) with `motion/react`: a huge title, a tidy meta grid, a big cover of CSS-drawn device mockups on a bold colour field, and three results. It should read like a studio that's proud of the work and has numbers to prove it.

**Layout**
- Section `#fbfaf6`, ink `#141414`, inner container `max-w-[1440px]` with 20/32/48px side padding.
- Top row in mono 11–12px uppercase, tracking 0.14em, 60% ink: "← All work" (44px tall link, arrow nudges left on hover) on the left, "07 / 12" with tabular figures on the right.
- Eyebrow 48–64px below: a 10px dot in the cover colour, then "Case study — Larder".
- Title: "The weekly shop, done in *four minutes.*", max 14ch. The emphasis phrase switches to italic Instrument Serif in the cover colour.
- A 1px rule at 15% ink, then a 12-col grid: the intro paragraph (cols 1–5, max 46ch) and a `dl` meta grid (cols 6–12) of 4 columns: Client, Year, Role, Deliverables. Array values stack one per line. 2 columns on mobile.
- Cover: a `figure` with radius 24px (32px at lg), `aspect-square` on mobile, 4/3 at sm, 16/9 at lg, filled with `coverColor` (`#1b8a4f`). Behind the devices: a yolk circle (`#ffd43b`) bleeding off the top-right corner, a 22px dot grid at 14% cream, and a mono caption top-left (hidden on mobile).
- Devices: a laptop (64% of the cover width at lg, left 11%, top 11%) and a phone (17% wide, right 12%, bottom 7%, rotated 5°) overlapping the laptop's right edge. On mobile the laptop is 118% wide and bleeds off the right behind a 37%-wide phone.
- Results: a mono heading, then 3 columns (stacked on mobile), each with a 2px ink top rule, a big number and a 15px caption (max 30ch, 75% ink).

**Device mockups (all CSS, sized in container query units)**
- Make each device an `@container` and size everything inside in `cqw` so the picture scales as one unit at any width.
- Laptop: a `#121412` bezel (padding 1cqw, top radius 2.6cqw) around a 16/10 screen, and a `#d9d6cf` base 6% wider each side, 1.8cqw tall, with a `#b9b5ac` notch.
- The screen is a fictional meal-planner web app on `#fffdf8`: a cream sidebar (logo, "This week" active in ink, Pantry with a radish badge, household initials avatar), and a main column with "Week of 12 October / Four dinners, two from leftovers", a green "Fill basket" pill, and five day cards. Each day card has a coloured tile with a CSS plate, the meal name, the time, and ingredients with green (have) or radish-ring (buy) dots. Below them, a weekly spend bar chart (last bar green), a dark "Saved from the bin 3.2 kg" tile and "Use it up" chips. A cream basket panel on the right lists items with prices and a yolk slot button.
- Phone: a `#121412` frame (radius 16cqw, padding 3.4cqw) around a 9/19.5 cream screen with a dynamic-island pill. It shows a Basket screen: a progress bar, a checklist (done items struck through at 45%), a delivery slot card and a dark "Check out £48.20" bar.
- Soft coloured drop shadows only on the devices: `drop-shadow(0 30px 40px rgba(10,40,20,0.35))`.

**Typography**
- Title: display 800, `clamp(3rem, 1.2rem + 7.2vw, 8.75rem)`, leading 0.9, tracking −0.055em. The emphasis is serif 400 italic, tracking −0.035em.
- Intro 17–18px, leading 1.6, 80% ink. Meta labels in mono 11px uppercase at 55%. Values 15px medium.
- Stats: display 800, `clamp(3.5rem, 2.4rem + 3.6vw, 6.5rem)`, leading 1, tracking −0.06em, tabular figures. The unit is italic serif at 0.5em in the cover colour.

**Colour**
- Page `#fbfaf6`, ink `#141414`, cover `#1b8a4f`, yolk `#ffd43b`. App UI: cream `#fff8ec`, paper `#fffdf8`, ink `#1d2b22`, radish `#ff7a8a`, mint `#9fd8b4`, line `#eadfca`.

**Motion**
- On mount: the eyebrow, title and meta rise 12–24px and fade in (0.8s, ease [0.2, 0.8, 0.2, 1], staggered 0–140ms). The cover rises 40px at 200ms, the laptop slides up 8% at 350ms, and the phone slides up 18% while rotating 0 → 5° at 500ms. The stats rise from 550ms, staggered 80ms.
- Reduced motion: everything renders in place, with the phone already at 5°.

**Accessibility**
- A `section` labelled by the h1 (id from `useId`). The cover is a `figure` with an sr-only `figcaption`, and both mockups are `aria-hidden`. Stats sit under an h2. The back link has a visible focus style.

**Don't**
- No PNG device frames or stock screenshots. The UI is drawn in markup so it's crisp and themeable.
- No empty grey rectangles pretending to be UI. Fill the screens with plausible, specific content.
- No gradient backgrounds on the cover, no glassmorphism, and no centred title.
