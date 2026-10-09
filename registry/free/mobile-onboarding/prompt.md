Build a four-step onboarding pager in React Native for a fictional focus app, "grove", where swiping moves one day forward through a moonlit, monochrome landscape: pre-dawn, morning, dusk, night. Use `Animated`, `PanResponder`, `expo-blur`, `expo-linear-gradient` and `react-native-svg`, with nothing else. One `Animated.Value` called `pos`, measured in pages, drives the scene, so every layer answers the finger in the same frame. Dark first, true greys, and exactly one colour: the grove.

**Layout** (390×844 reference; measure with `onLayout`)
- **Sky:** full-bleed. One three-stop `LinearGradient` per step (locations 0 / 0.5 / 0.86), stacked. Layer `i` has opacity `clamp(pos − (i − 1), 0, 1)`, so mid-drag the greys truly interpolate.
- **Top bar:** `top: 54`, 44pt tall, 16pt side padding.
  - Centre: a two-leaf SVG mark (22pt, the only accent in the bar) and "grove" at 20pt/700, tracking −0.7.
  - Left: a 40pt dark-glass circle with a drawn chevron (Back). It fades in and slides 8pt across `pos` 0→1.
  - Right: a 40pt dark-glass "Skip" pill (15pt/600). It fades out on the last step.
- **Card:** near-black glass, 12pt from the sides and bottom, 336pt tall (304 under 760pt), radius 32. Inside, 24pt horizontal padding and 22pt at the top: the progress dots and a mono clock, the copy area (mono kicker, title, body), then a 56pt pill button.
- **Scene:** above the card. Horizon (far ridge) 146pt above the card, middle hills 100pt, near meadow 56pt (118 / 82 / 46 compact).
- **Chips:** one floating glass chip per step, 84 or 132pt above the horizon, right on steps 1–2 and left on 3–4. Auto width (max 300), 12/14pt padding, radius 22.

**Illustration** (all SVG, ids from `useId`)
- **Each step is a time of day in greys:** `scene = { sky[3], land[3], sun {x, altitude}, moon {x, altitude}, stars 0–1, mist 0–1 }`.
  - Pre-dawn 05:40: sky `#060606 → #151515 → #303030`, land `#202020 #131313 #0A0A0A`, moon high (186pt), sun set, stars 0.65, mist 0.4.
  - Morning 08:20: sky `#202020 → #444444 → #767676`, land `#585858 #383838 #1C1C1C`, sun up (150pt), no stars, mist 0.85.
  - Dusk 18:40: sky `#0C0C0C → #242424 → #4A4A4A`, land `#2C2C2C #1B1B1B #0F0F0F`, sun on the horizon (22pt), stars 0.18.
  - Night 21:30: sky `#020202 → #090909 → #171717`, land `#1A1A1A #0E0E0E #070707`, moon at 196pt, stars 1.
- **Sun and moon:** each its own body (sun: a 460pt white radial glow, 21pt disc `#FFFFFF → #E6E6E6`; moon: a 300pt glow, 17pt disc `#F7F7F7 → #BDBDBD` with five faint craters). Each interpolates x and y through the steps with a midpoint lifted 26pt, so it arcs rather than slides, and never rises above the top bar (clamped at 138pt) on short screens.
- **Stars:** 110 seeded dots, smaller and fainter toward the horizon; the layer's opacity follows each step's `stars`.
- **Hills:** three summed-sine silhouettes sampled every 6pt, each drawn once per step's grey and crossfaded like the sky. Atmospheric perspective: the far ridge hazes toward white at its base, the middle hills darken 45% to the base, the meadow has a lit lip and falls 75% into shadow. A 1pt white crest line on each, whose opacity follows the light of the step (0.12 + strength × 0.4).
- **Mist:** soft radial banks wandering between the far and near valleys at random depths (never one ruled stripe), opacity from each step's `mist`.
- **Light and shadow:** a step's key light is the higher of the sun and the moon (moon at 70% strength). Its altitude sets the strength (0.12–1) and its x sets which way each tree's contact shadow falls (±0.42 × the tree width) and how dark it is.
- **Parallax:** rates per page are mist 0.14, far 0.22, middle 0.48, near 0.8, chips 1.12, copy 0.32 of the width. Each layer is padded by 0.62 × its travel at both ends, so rubber-banding never shows an edge.
- **The grove, the one colour:** 13 trees on the meadow, round (three radial-gradient circles `accent +28% white → accent → accent −62% black`, a dark trunk, a soft highlight) or pine. Each grows from its foot as `pos` approaches its page (page − 0.75 to page − 0.05). The first sapling grows from 0.55 to 1 across step 1.
- **Grain:** a 96pt pattern of 240 scattered 1pt dots (white 5%, black 14%) over everything, so the big grey gradients never band. A 150pt black scrim at 42% keeps the top bar legible on the brightest morning.

**Colour**
- Neutral family: ground `#050505`, ink `#F5F5F5` at 100 / 64 / 42%.
- **Accent:** one prop, default `#8BE0A4`. It is used only for the grove, the brand mark, the "+1" badge, the best day in the week chart and the last step's button, halo and planting flourish.
- **Glass:** `BlurView` dark tint (60 on the card, 30 on chips), a smoked wash `rgba(30,30,30,0.66) → rgba(10,10,10,0.8)` on the card (`rgba(44,44,44,0.5) → rgba(14,14,14,0.62)` on chips), a 10% white hairline, `inset 0 1px 0` white 16% and a dark inset at the bottom. Fades are applied to each glass layer, never to an ancestor of the blur.
- **Button:** a white pill `#FAFAFA → #D6D6D6` with near-black text on steps 1–3; across the last 0.6 page it crossfades to the accent (`+30% white → accent → −14% black`) with a soft accent halo underneath.

**Typography**
- Kicker: mono 11pt, tracking 1.4, uppercase, ink 42%.
- Title: 32/35, weight 700, tracking −1.1 (28/31 compact). Body: 16/23 at 64% (15/21 compact).
- Chip value 16pt/700 with tabular numerals; label 12.5pt/500. Clock: mono 12pt, tabular. Button: 17pt/600.

**Entrance choreography**
- **First view** (760ms linear driver, each block eased on its own window): the whole scene comes up out of black (scrim 0–60%), hills rise 10/18/28pt, the sun and moon 24pt, the brand blurs in, the card's glass fades and the card rises 28pt (its transform is dropped once it lands, so the blur keeps working), the clock winds up from 00:00 to the step's time, and the progress dots arrive last, one by one.
- **Every step, every time it becomes current** (720ms linear timeline per step, eased cues): kicker (0–50%), title (7–57%), body (14–64%), the chip (22–70%), its figure (34–84%), its data (42–100%), the badge last (68–100%). Each block fades in, rises 8–14pt and clears a 4–7pt blur (`filter: blur()` on web; on native, where `filter` cannot animate, a 0.98 → 1 scale instead).
  - Breath chip: the ring draws along its path (72% sweep), the dot fades up, "2:00" counts up from 0:00.
  - Focus chip: the stopwatch glyph draws on (stroke-dashoffset 64 → 0); "+1" pops last with one overshoot (0.6 → 1.08 → 1).
  - Week chip: seven bars grow from the baseline left to right (stagger 0.05 of the timeline), the best day in the accent; "14 trees" counts up.
  - Reminder chip: the bell draws on; "Tomorrow, 7:30" counts up with the minutes keeping their leading zero.
  - Numbers count in tabular numerals padded with figure spaces, so nothing reflows, and settle from a 3pt blur.
- A step's timeline resets only once it is a full page off screen, so dragging back to a half-visible step never pops it out and in; returning later replays the full entrance.

**Motion**
- **Drag:** follows the finger 1:1. Past either end it rubber-bands as `(1 − 1/(o·0.55 + 1)) · 0.6` pages. On release it projects `pos + v·0.22s`, moves at most one page, and springs (stiffness 320, damping 30) with the release velocity.
- **Taps:** Continue and Back animate `pos` over 560ms ease-in-out `(0.65, 0, 0.35, 1)`. Skip takes 760ms through every sky.
- **Progress:** built only from transforms: each dot is two 7pt caps and a 10pt bar scaled on X; widths 7 → 26 → 7 around each page, so the pill stretches and passes along mid-drag. Active 100%, others 22%.
- **Clock:** tweens its minutes with the drag and snaps to the step's own time within 0.03 page.
- **Ambient:** only the breath dot breathes (0.7 ↔ 1.15, 2.4s each way), and only while its step is showing.
- **Press:** 90ms to 0.97, spring back (stiffness 420, damping 22).
- **Planting:** the final tree springs up (stiffness 200, damping 17) behind an accent glow, with five blossom dots; 14 leaves (accent and pale grey) burst in a 168° fan over 1.1s, with an accent ring and halo bloom; the label crossfades to a drawn check and "Planted. See you at 7:30". `onFinish` fires at 1.1s.
- **Reduced motion:** no parallax (the land holds still and the whole grove shares one window, drawn at 78%), page changes and entrances become 150ms fades, numbers set instantly, no breathing and no burst.

**Accessibility**
- Back, Skip and the main button are buttons with labels; the main button is `disabled` once planted.
- The copy area is `adjustable`, labelled with the current title and body, value "Step n of 4", with increment/decrement actions.
- Count-ups expose the final value as their label. Decorative SVG sits in `aria-hidden` wrappers. The planted state is announced.

**Don't**
- No colour beyond the one accent: no tinted skies, coloured washes or rainbow chips.
- No Lottie, images, emoji, icon packs, Reanimated or gesture-handler.
- No pagination that jumps, no animated `width`, no parallax edges in overscroll.
- No transform left on an ancestor of a `BlurView` at rest, and no fading an ancestor of one.
- No confetti, nothing that bounces more than once, and no text that pops in unanimated.
