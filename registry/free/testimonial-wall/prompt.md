Build a testimonial wall in React + Tailwind CSS v4 + `motion/react`: endless vertical columns of quote cards drifting at different speeds, masked at the top and bottom. Calm enough to sit on a landing page all day; the moment you reach for a card, its column glides to a stop.

**Layout**
- Root is an `@container` section with a fixed height (default 720px; one column caps at 600px). Measure the root with ResizeObserver: 3 columns from 900px wide, 2 from 560px, otherwise 1. Deal testimonials round-robin into the columns. Gap 16px (20px from `@3xl`).
- Each column is an `overflow: hidden` viewport with `mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)`.
- Inside: a track with three copies of the column's set (clone, real, clone). Each set is a flex column with the gap and a trailing gap as padding, so one set's height is exactly one period P. If a set is shorter than the viewport, repeat its items until it isn't.

**The signature: velocity easing, not a pause**
- One rAF loop per column, writing `translate3d(0, y − P, 0)` directly to the track. Column speeds default to 24, 30 and 20 px/s; odd columns drift down, even columns up. Each column starts at a different phase (P × ((i × 0.37 + 0.11) mod 1)).
- Velocity eases exponentially towards its goal each frame: `v += (goal − v)(1 − e^(−dt/τ))`, τ = 0.32s when stopping (hover, focus, paused), 0.7s when setting off again. A hover glides to a stop over about a second and pulls away just as gently.
- y wraps modulo P, which is invisible because the copies are identical.
- Loops run only while the wall is in view and the tab is visible.

**Cards**
- `figure`, focusable, radius 16px, `#0c0c0d`, inset hairline white/7% and a top highlight white/5%, padding 20px (24px from `@3xl`).
- Quote 15px, leading 1.6, tracking −0.005em, white/55, `text-wrap: pretty`, real curly quotes. One phrase marked `**…**` renders at white/90, so each card has a hook you can scan.
- Caption: a 36px initials avatar (mono 11px; radial gradient from `hsl(h 32% 26%)` to `hsl(h 30% 12%)`, initials `hsl(h 70% 84%)`, hue hashed from the name, inset ring at 18%). Name 14px/500 white/90 with a 13px eight-lobed verified seal in `#8ab8ff` with a `#0b0b0c` check. "Role, Company" 13px white/40, truncated.
- Hover (one step): lift 3px, surface to `#111113`, a deep soft shadow, and a pointer spotlight: a 320px radial wash at 5.5% white on the surface plus a 180px radial arc at 42% white on the 1px border (mask-composite exclude). Position comes from CSS variables written on pointermove, so moving never re-renders. 200ms ease-out.

**Keyboard and focus**
- Focusing a card stops its column and glides the card fully into view, clear of the faded edges (margin max(56px, 15% of height)), with a 110ms exponential follow. Blur resumes the drift.
- Focus inside an overflow-hidden box would scroll it; reset `scrollTop` to 0 on scroll and move the track instead.
- Clones are `aria-hidden` and `inert`; repeated items are `tabindex=-1`.
- A 32px round pause/play button (44px hit area) in the bottom-right corner, `aria-pressed`, `#141416` with a hairline ring.

**Entrance**
- Once, at 20% in view: each column rises 16px and fades in over 700ms ease-out with a 70ms stagger.

**Reduced motion**
- A static grid: the same columns at natural height, no masks, no clones, no drift, no lift.

**Don't**
- No star ratings, no logos-as-images, no photos, no gradient borders at rest, no abrupt `animation-play-state: paused`. No CSS keyframe marquee (it can't ease to a stop). No more than one bright phrase per quote.
