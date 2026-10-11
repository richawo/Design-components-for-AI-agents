Build one profile card in React + Tailwind CSS v4 + `motion/react` (+ one `lucide-react` icon). Not a team section and not a social feed: a single card on a quiet black stage. The idea is that a person arrives in order (ring, name, numbers) and that Follow is one object that changes state rather than two buttons swapping. Monochrome with one accent, on the avatar ring and the Following check only.

**Tokens** (one `PALETTE` with `dark` and `light`, written to CSS variables on the root; one `T` timeline in seconds; named springs)
- Dark: card `#0c0c0d`, ink `#f4f4f5`, on-ink `#0b0b0c`, danger `#ff6b6b`. Rest shadow: inset 1px ink/8% hairline, inset ink/6% top highlight, `0 40px 80px -44px rgba(0,0,0,0.95)`; lifted shadow: hairline ink/11% and `0 56px 96px -40px #000`.
- Light: card `#ffffff`, ink `#111113`, on-ink `#ffffff`, danger `#d93636`, same structure with ink-tinted soft shadows. Stage `#000` dark, `#f4f4f5` light.
- `accent` prop, default `#ff8a4c`. Everything else is ink at an opacity (`color-mix(in srgb, ink N%, transparent)`).

**Layout** (`@container` root; `layout` prop)
- Vertical (default): max-width 380px, radius 22px, padding 24px (28px from `@sm`), centred text. Avatar 88px, name 20px below, mono meta line, bio (max 34ch), stats panel 24px below, actions 20px below.
- Horizontal: max-width 640px, one CSS grid. Narrow: `64px | 1fr` with avatar and name side by side, bio full width, actions full width under it. From `@lg`: `84px | 1fr | auto`; the avatar spans two rows, the actions sit top right at their own width, the bio sits under the name. Stats run along the foot under a hairline.
- Avatar: initials (from the first and last word of the name) in Geist 500, tracking −0.03em, on a disc inset 9% from an SVG ring. The disc is a subtle radial from ink/12% to ink/4% mixed into the card, with an inset ink/10% top highlight. The ring is a 2px ink/8% track plus a 2.25px accent circle, rotated −90° so it starts at twelve o’clock.
- Stats: a `dl` of N equal columns. Vertical: inset panel (ink/3%, inset ink/6%, radius 14px, 14px vertical padding), centred cells split by ink/8% hairlines. Horizontal: left-aligned cells, 16 to 24px left padding after the first, a top hairline with 20px above the figures.
- Actions: Follow (44px tall, radius 12px, 20px side padding) beside a 44px square message button with an inset ink/12% hairline.

**Typography**
- Name: Instrument Serif 400, 34px vertical, 28px to 32px horizontal, leading 1.02, tracking −0.015em.
- Meta: Geist Mono 11px uppercase, tracking 0.08em, ink/52, items split by a slash at 50% opacity: role / location / local time (ink/38, tabular). The clock is read after mount via `Intl.DateTimeFormat` with the `timeZone` prop and refreshes every 30s; an invisible "00:00" holds its width before then.
- Bio: 14.5px, leading 1.6, ink/66.
- Figures: Geist 500, 20px (22px from `@md`), tracking −0.03em, tabular. Labels: mono 10.5px uppercase, tracking 0.09em, ink/45, under the figure.

**Motion** (ease `[0.22, 1, 0.36, 1]`)
- Entrance, once at 30% in view: each block rises 6 to 16px out of an 8px blur over 550ms in order: card 0s, avatar 0.12s, name 0.2s, meta 0.26s, bio 0.32s, stats panel 0.4s, actions 0.46s. The ring draws via `pathLength` 0 to 1 over 800ms from 0.22s.
- Figures count from zero from 0.52s, 70ms apart, 900ms each, with a 5px blur that clears as they land, written from a motion value (no React state per frame). Values from 100,000 use compact notation (decided from the target so the format never flips mid-count).
- Follow morph: one button. Fill drains from ink to ink/5% with an ink/14% hairline (200ms). The icon is two SVG strokes whose `d` animates (320ms, ease `[0.65, 0, 0.35, 1]`): the plus folds into a check stroked in the accent; on hover while following they cross into an x and the label turns danger. Labels cross-fade in one grid cell (in from y 6px and a 3px blur over 240ms, out to y −6px in 140ms ease-in); every label is laid out invisibly in that cell so the button never changes size. "Unfollow" is only offered after the pointer has left the button once, so the click that followed never shows it.
- The follower stat (`tracksFollow`) ticks up by one on follow: it tweens 420ms and rises 6px out of a 2.5px blur; unfollowing drops it from above.
- Hover (mouse only): the card lifts 4px on spring 180/22 and its shadow deepens; a 240px radial spotlight (ink 5% dark, 3.5% light) tracks the pointer, and a brighter copy is masked to the 1px edge (`mask-composite: exclude`). Both fade on a spring. Buttons press to 0.97; the message icon nudges up 1px on hover; Follow gets a card-coloured 10% veil on hover.
- Reduced motion: every block fades in over 150ms, the ring is already drawn, figures are set instantly, no lift, no blur, no icon morph.

**Accessibility**
- `article` labelled by the name (`h3`). The avatar is `aria-hidden` (the name is right there).
- Follow is a toggle: `aria-pressed`, a constant `aria-label` ("Follow Mara Okonkwo"), visible labels `aria-hidden`. A polite status region says "You’re following Mara Okonkwo." or "You unfollowed Mara Okonkwo.".
- Message button: `aria-label` "Message Mara". Both are 44×44px minimum with a 2px ink focus outline offset 2px, keyboard only.
- Animated figures are `aria-hidden` with an sr-only copy of the final value; the clock is prefixed "Local time" for screen readers.

**Content**
- Mara Okonkwo, Type designer, Lisbon, PT, Europe/Lisbon. Bio: "Draws letters for screens people read at 2am. Currently losing an argument with the lowercase g of a grotesque." Stats: Followers 12,481 (tracks follow), Following 318, Typefaces 27.

**Don't**
- No cover photo, gradient banner, verified badge or network avatar image.
- No accent on the Follow fill, the stats or the text; the accent is the ring and the check.
- No button that resizes or jumps between Follow and Following, and no Unfollow flash right after following.
- No glow around the card, no tilt, no bouncing entrance, no per-frame React state for the counting figures.

**Robustness**
Secondary text uses at least 65% ink. Announce following only after the effective controlled or internal state changes. Reset the local clock when the time zone changes, including invalid zones.
