Build a tiny loader in React 19 + Tailwind CSS v4 + `motion/react` whose two strokes morph between geometric shapes while a job runs, then fold, in place, into a check on success or a cross on error. It is a status glyph, not a spinner bolted next to an icon: the same two lines are the loader, the check and the cross, so the eye never loses the thing it was watching.

**Layout**
- One inline `span` (inline-flex, `size × size`, default 20px) holding a 24-unit SVG (`viewBox="0 0 24 24"`, like an icon) and a visually hidden live region. The box never changes size between statuses, so a button or a row around it never reflows.
- Two `path`s, each exactly 36 points. Every shape is a closed outline sampled by arc length, starting at the top centre and running clockwise: path A is the right half (top → bottom), path B the left half (bottom → top). Because point i of one shape sits near point i of the next, a morph is a straight per-point interpolation that never crosses itself.
- Shapes (box units, centre 12,12): circle radius 7.4; square ±6.4 (sampled from the middle of its top edge so its top is flat like the circle's); triangle radius 8.5 nudged down 1.6 to sit optically centred; diamond 8; hexagon 7.7.
- The glyphs are two straight strokes mapped onto the halves nearest them. Check: A runs 17.4,8.4 → 10.4,16.1 (the long leg), B runs 10.4,16.1 → 6.7,12.4 (the short leg); they meet at the outline's bottom. Cross: A 16.6,7.4 → 7.4,16.6, B 16.6,16.6 → 7.4,7.4.

**Typography (demo only)**
- Card title: display face, clamp(1.25rem, 0.9rem + 2.2cqi, 1.75rem), weight 500, leading 1.1, tracking −0.03em, balanced. Sub line 13px/20px tabular. Eyebrow mono 11px uppercase, tracking 0.16em. Step rows 14px/20px, tracking −0.01em; their meta in mono 11px tabular.

**Colour**
- Loading and idle ink is `currentColor` (the demo uses #f4f4f5 on #111113). Idle drops the whole glyph to 45% opacity.
- Semantic only: success #6fd08c, error #ff7a6b. The stroke colour transitions over 200ms as the fold starts. Nothing else is coloured.
- Demo: stage #050506, card #111113 with an inset 1px rgba(255,255,255,0.08) ring, a 1px top highlight at 4% and a deep soft shadow; specimen tile white 2.5% with a 6% ring; muted text #a1a1aa, faint #8a8a93, hairlines white 6%.

**Motion**
- One rAF loop writes the two `d` attributes straight to the DOM (never through React state), and only runs while loading or mid-fold; it stops offscreen (IntersectionObserver) and in hidden tabs.
- Loop: each shape holds for 32% of a 0.9s segment, then morphs into the next with a cubic ease-in-out. The whole drawing turns once every 2.6s. While a shape travels the two halves open into chasing arcs (each end trimmed by 2.5% → 10% of the perimeter along a sine of the morph), closing again as the shape lands. `speed` multiplies the clock.
- Fold: any status change captures the strokes exactly where they are and interpolates to the new pose: 460ms ease-in-out into a check or cross, 320ms ease-out back out into the loop. A change mid-morph or mid-turn never jumps. `onSettled` fires when a fold lands.
- Reduced motion: no turn, no morph, no breathing: loading is a still, slightly open outline; status changes are instant with only the 200ms colour change.

**Accessibility**
- The SVG is `aria-hidden`. A visually hidden `role="status"` `aria-live="polite"` span carries `label` / `successLabel` / `errorLabel`; set `announce={false}` when a parent (a button, a row) already speaks the state.
- The demo's Retry and Publish are real buttons with 2px focus rings offset on the card colour, press scale 0.97, and Publish is disabled (40%, not-allowed) while the run is going.

**Demo**
- A publish run on one card: a 52px specimen (the featured instance, which takes the Customize overrides) in an 88–104px tile beside a cross-fading title, four step rows with 16px loaders, and a footer with a count and one button.
- It opens on the last release, already live ("v4.1 is live", four checks), so nothing moves until a click. "Publish v4.2" resets the rows to queued and runs them: each step loads, then folds into a check; the third ("Purge the edge cache") folds into a cross with "timed out", the specimen follows into a cross, and a solid "Retry step 3" takes the button's place. Retry runs the remaining steps and the specimen folds into a check: "v4.2 is live". The title swaps wait for the old line to leave (160ms) before the new one rises in.

**Don't**
- Don't swap a spinner for a separate check icon with a cross-fade; the strokes themselves must travel.
- Don't bounce, spring or shake the glyph; the fold is the payoff.
- Don't colour the loading state, add a glow, or put the loader in a rounded square with a gradient.
- Don't let the box resize between statuses, and don't loop while offscreen.
