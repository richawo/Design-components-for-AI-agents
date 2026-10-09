Build a testimonial wall in React + Tailwind CSS v4 + `motion/react`: endless vertical columns of quote cards drifting at different speeds, masked at the top and bottom. Greyscale and dark by default (a `theme` prop gives a polished light version), calm enough to sit on a landing page all day; the moment you reach for a card, its column glides to a stop. One focused component: no headline or section chrome around it.

**Layout**
- Root is an `@container` section with a fixed height (default 720px; one column caps at 600px). Measure the root with ResizeObserver: 3 columns from 900px wide, 2 from 560px, otherwise 1. Deal testimonials round-robin into the columns. Gap 16px (20px from `@3xl`).
- Each column is an `overflow: hidden` viewport with `mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)`.
- Inside: a track with three copies of the column's set (clone, real, clone). Each set is a flex column with the gap and a trailing gap as padding, so one set's height is exactly one period P. If a set is shorter than the viewport, repeat its items until it isn't.
- Sub-components `Column`, `StaticColumn`, `Card`, `Quote`, `Avatar`, `VerifiedSeal`, `PauseButton`; hooks `useColumnCount`, `useOnScreen`, `useCascade`.

**Cards**
- `figure`, focusable, radius 16px, padding 20px (24px from `@3xl`), an inset 1px hairline and a top highlight.
- Quote 15px, leading 1.6, tracking −0.005em, body grey, `text-wrap: pretty`, real curly quotes. One phrase marked `**…**` renders in the ink colour, so each card has a hook you can scan.
- Caption: a 32px grey initials disc (mono 10.5px, radial gradient) inside a 36px hairline ring; name 14px/500 in ink with a 13px eight-lobed verified seal in the accent; "Role, Company" 13px meta grey, truncated.
- Hover (one step): lift 3px, a deep soft shadow, and a pointer spotlight: a 320px radial wash on the surface plus a 180px radial arc on the 1px border (mask-composite exclude). Position comes from CSS variables written on pointermove, so moving never re-renders. 200ms ease-out.

**Colour (monochrome first; tokens in one PALETTE object as `--wall-*` CSS variables)**
- Dark (default): card `#0c0c0d` (hover `#111113`), hairline white/7%, top highlight white/5%, ink `#f4f4f5`, quote `#94949a`, meta `#7c7c84`, avatar `#2c2c30` → `#151517` with `#d4d4d8` initials and a white/22% ring, spotlight white 5.5% / edge white 42%, pause control `#141416`.
- Light: card `#ffffff`, hairline `rgba(24,24,27,.08)`, ink `#18181b`, quote `#5b5b63`, meta `#71717a`, avatar `#f4f4f5` → `#e4e4e7` with `#3f3f46` initials, spotlight `rgba(24,24,27,.035)` / edge `.28`, a soft grey lift shadow.
- One `accent` prop (default: the theme's ink): the verified seal; its check is black or white by luminance. No hue per person, no blue badges.

**The signature: velocity easing, not a pause**
- One rAF loop per column, writing `translate3d(0, y − P, 0)` directly to the track. Column speeds default to 24, 30 and 20 px/s; odd columns drift down, even columns up. Each column starts at a different phase (P × ((i × 0.37 + 0.11) mod 1)).
- Velocity eases exponentially towards its goal each frame: `v += (goal − v)(1 − e^(−dt/τ))`, τ = 0.32s when stopping (hover, focus, paused), 0.7s when setting off. Columns start at rest and only set off 0.85s after the entrance, so the wall lands, then begins to breathe.
- y wraps modulo P, which is invisible because the copies are identical. Loops run only while the wall is in view and the tab is visible.

**Entrance (once, at 20% in view; ease-out `[0.22, 1, 0.36, 1]`; timings in one MOTION object)**
- Every card on screen rises 14px out of an 8px blur over 0.5s. Its delay comes from where it sits: column × 50ms + (its top ÷ column height) × 260ms, so cards land in reading order, left column first, top to bottom. The whole wave is done by ~0.85s.
- 160ms after a card lands its avatar ring draws round (stroke-dashoffset 1 → 0 with `pathLength=1`, 0.55s).
- The pause button rises 6px out of a 4px blur at 0.62s.
- The cascade is imperative (one `animate(0, 1, { onUpdate })` per card writing opacity, transform and filter) because the cards live in a track the drift loop moves directly; it is ordered by on-screen position, and cards mounted later render settled. Unmounting completes any running tween.

**Keyboard and focus**
- Focusing a card stops its column and glides the card fully into view, clear of the faded edges (margin max(56px, 15% of height)), with a 110ms exponential follow. Blur resumes the drift.
- Focus inside an overflow-hidden box would scroll it; reset `scrollTop` to 0 on scroll and move the track instead.
- Clones are `aria-hidden` and `inert`; repeated items are `tabindex=-1`. Focus ring: 2px ink outline, 2px offset.
- A 32px round pause/play button (44px hit area) in the bottom-right corner, `aria-pressed`, scale 0.94 while pressed.

**Reduced motion**
- A static grid: the same columns at natural height, no masks, no clones, no drift, no lift; the wall fades in over 150ms.

**Don't**
- No star ratings, no logos-as-images, no photos, no hue-from-name avatars, no coloured badges, no gradient borders at rest, no abrupt `animation-play-state: paused`. No CSS keyframe marquee (it can't ease to a stop). No more than one bright phrase per quote.
