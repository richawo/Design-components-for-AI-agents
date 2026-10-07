Build an editorial hero section in React + Tailwind CSS (v4) using `motion/react` for one animation. It should feel like a confident independent design studio's homepage, not a SaaS template.

**Layout**
- Warm paper background `#f4f0e8`, ink text `#16130f`. Max width 80rem, generous side padding (20px mobile, 48px desktop).
- Top row in mono, 11–12px, uppercase, 0.14em tracking, 60% ink: a status line with a small green live dot (pinging) on the left, a location on the right. Wraps on mobile.
- The headline dominates: display font, weight 800, `clamp(2.9rem, 1.2rem + 7.4vw, 8.25rem)`, line-height 0.92, tracking −0.055em, max 15ch wide. It reads "We design products people [word]".
- The last word rotates through 3–4 options ("remember.", "recommend.", "pay for.", "brag about.") set in an italic serif (Instrument Serif), normal weight, in tomato `#ff4f1f`, with a hand-drawn squiggle underline in ink beneath it.
- Below, a 1px rule at 15% ink, then a 12-column grid: body copy (max 44ch, 17–18px, 75% ink) left; actions right-aligned on desktop, stacked on mobile.
- Primary CTA: 56px-tall black pill with a tomato circular arrow chip on its right that rotates −45° on hover. The secondary is a plain text link with a thick, offset underline that turns tomato on hover.
- Bottom row: a "Trusted by" mono label, then five fictional client names, each set in a different style (bold display, italic serif, spaced mono caps, light display, semibold sans) so they read like real wordmarks.
- A 144–176px butter-yellow (`#ffd23f`) circular badge sits bottom-right of the headline block, in the whitespace above the rule (hidden below md). Text runs round its edge on an SVG textPath, it spins once every 18s, and a star sits in the centre.

**Motion**
- The rotating word slides up out of an overflow-hidden mask (enter from 105%, exit to −105%) over 0.7s with ease [0.2, 0.8, 0.2, 1], changing every 2.2s.
- Stack every word invisibly in the same grid cell so the headline never reflows when the word changes.
- Respect `prefers-reduced-motion`: no rotation, no spin, no ping.

**Accessibility**
- Put the full headline, with all the words, in an `sr-only` span and set `aria-hidden` on the animated version.
- Links have visible focus states, and the colour contrast passes AA.

**Don't**
- No gradients, glassmorphism, emoji or stock illustrations.
- No "Unlock the power of" copy.
- No centred layout; the asymmetry is the point.
