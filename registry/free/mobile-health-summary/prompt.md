Build a dark, monochrome daily health summary in React Native (core `Animated`, `Pressable`, `Animated.ScrollView`) with `expo-blur`, `expo-linear-gradient` and `react-native-svg`. Its idea is the ring as an instrument: three concentric activity rings that draw themselves in, lap past 100% into a deeper shade, and can be isolated with a tap so the centre readout morphs to that metric. Everything around the rings is black, white and grey, so the rings are the only colour that matters, and the whole frame is choreographed on first view.

**Layout** (390pt wide reference, 16pt side gutters, 56pt top padding for the status bar; scrolls)
- Header: an uppercase date line ("FRIDAY, 9 OCTOBER", 12pt, weight 600, tracking 1.1) over "Summary" (34pt, weight 700, tracking −1.1, line height 38). On the right, a 42pt avatar: a 34pt graphite disc (#1C1C1C, inset top highlight) with initials (13pt, weight 700), inside a 1.6pt ring drawn in a white gradient (95% → 28% opacity).
- Week selector: a graphite surface (radius 22) with seven equal columns, each a weekday letter (12pt, weight 700; selected #F5F5F5, others 56% white) over three 30pt mini rings in the ring colours. A pill (radius 16, white 15% → 6% gradient, top hairline at 20%) glides between columns. Future days sit at 40% opacity with empty tracks and are disabled.
- Rings: a 264pt square. Stroke 22, gap 3, outer radius 264/2 − 6 − 11. Tracks are the ring colour at 16%. A neutral pool of light (white radial, 6% → 0) sits under them. The centre holds a micro label ("TODAY" or the weekday, 10.5pt, weight 700, tracking 1.4), a 34pt tabular value with a 16pt muted suffix ("/3" or "%"), and an 11pt sub line ("rings closed", "+72 kcal over", "3 hr to go").
- Legend: three columns under the rings: a 12×4 gradient swatch in the ring colour, the label (12pt, 56% white), then the value (19pt, weight 700, white) with "/540 KCAL" muted. The columns are also the accessible ring buttons.
- Cards (10pt gaps, radius 24, 16pt padding): Steps (flex 1.18) with value, "6.1 km · goal 10,000" and a 34pt sparkline of hourly steps; Heart (flex 1) with resting bpm, range and an ECG trace; Sleep (full width) with time asleep, "IN BED 23:27 – 06:41", a 10pt stacked bar (Deep, Core, REM, Awake; 2pt gaps; radius 3) and a 4-column key. Card labels and icons are 56% white.

**Rings, drawn properly**
- SVG has no conic gradient. Split each lap into two half arcs, each with its own `userSpaceOnUse` vertical gradient (right half: start colour → midpoint, top to bottom; left half: midpoint → end colour, bottom to top). The result reads as a sweep. Mask both with a full circle path that starts at 12 o'clock, with round caps and `strokeDasharray = circumference`, and animate `strokeDashoffset`. Paint a start-colour dot at 12 o'clock so the start cap isn't the end colour.
- Second lap: the same construction with a deeper gradient (Move #B3123F → #D4521F), driven by progress 1→2.
- Tip: an RN View rotated by `progress × 360°` carries a stroke-sized dot. Its colour is interpolated from progress (24 samples per lap) so it matches the gradient where the arc ends, and a forward shadow only, no coloured glow (`2px 0 6px rgba(0,0,0,.3)`, deepening to `3px 0 7px rgba(0,0,0,.6)` past 100%), so lap two visibly overlaps lap one.

**Colour (monochrome first)**
- One true-neutral family. Page #0D0D0D → #0A0A0A → #060606 with a faint white top light (7%) and a 4×4 dither of 1px dots at 2.5–4.5% so nothing bands. Surfaces #191919 → #141414 → #111111 with a 1px edge at 6% white (top edge 14%) and `0 18px 40px -18px rgba(0,0,0,.85)`. Ink #F5F5F5, secondary 56% white, faint 34%.
- Colour only where it is data: the rings (Move #FF3D6E → #FF8B52, Exercise #7DEB3A → #D9FF5C, Stand #1FD2F4 → #62A6FF), the focused ring's centre label, and one `accent` prop (default #FF3D6E) for the sparkline's "now" dot and the heartbeat comet.
- Sparkline: a white line fading from 30% to 95% left to right over a 12% → 0 white fill. ECG: a 20% white trace. Sleep stages: a white ramp, the deeper the brighter (Deep 94%, Core 60%, REM 36%, Awake 16%).
- Status bar: a 50pt scrim to the page colour at rest; once scrolled, a real `BlurView` (50, dark) with a hairline fades in over content passing beneath.

**Motion: first view** (ease-out 0.22,1,0.36,1; every cue starts a frame after mount)
- Blocks reveal in reading order: opacity 0→1, a 12pt rise (8pt for the date line), and a frosted veil that clears. The veil is a `BlurView` (tint `systemChromeMaterialDark`) laid over the block whose `intensity` animates 40→0 (an 8px blur on the web) over 560ms, then unmounts. The revealing block's own opacity makes it the veil's only backdrop, so it blurs the block, not the page. Drop the transform once landed: Chromium stops backdrop blur under a lingering transform.
- Cues (ms): date 0, title 50, week bar 100 (mini rings draw at 190 + 40 per day), ring stage 150 (rings draw from 220, staggered 70ms, 720ms + 160ms per lap), legend 240/290/340, Steps 300, Heart 350, Sleep 400. Each card's figures start 120ms after it, its chart 180ms after it. The avatar pops last (480ms, 0.8→1 with one small overshoot) and its ring draws along its path (560ms, 720ms).
- Every figure counts up from zero (760ms) with tabular numerals, fading in, lifting 5pt and clearing a 4px `filter: blur` as it lands (skip the filter on iOS, which can't draw it). The sparkline strokes in left to right (840ms), then its fill and the accent dot arrive. The ECG trace strokes in (640ms), then the comet starts running. Sleep segments grow from the left in sequence, 70ms apart, after their card lands.

**Motion: after that**
- Switching days (a lighter replay): the pill springs (stiffness 500, damping 40), the rings ease from where they are to the new values (820ms, 0.65,0,0.35,1, stagger 60ms), never from zero. Figures count from their previous value (620ms) with a light blur settle. The old sparkline and ECG fade out (110ms) and the new ones draw in 60ms later as they fade back, sleep segments re-flex, the date line and bed times crossfade with a 5pt rise. Containers stay put.
- Isolating: tap a ring (hit-tested by distance from the centre, using the touch point captured on press-in) or its legend column. The others dim to 10% and scale to 0.985, a neutral white halo fades in (a radial gradient transparent inside, peaking at 7% white at 68%: focus reads through luminance, not a coloured glow), the label crossfades and the value counts to the percentage. Tap again, or the centre, to return.
- The heart comet is the one ambient loop: a 46pt accent stroke runs the trace at the resting rate.
- Every Pressable springs to 0.9–0.97 and back with one small overshoot.
- Reduced motion: every entrance becomes a 150ms fade with no rise or veil, figures and rings are set instantly, the comet is off and crossfades are instant.

**Accessibility**
- Week days are tabs with selected and disabled state. The ring area is one button whose label reads all three values; legend columns are buttons with selected state. The sleep bar has a spoken summary of every stage. The avatar is a "Profile" button.

**Code**
- Small named pieces: `useCue` (a once-per-mount 0→1 cue), `Reveal` + `Veil`, `useCount` + `CountUp`, `Swap`, `Squish`, `Surface`, `Avatar`, `WeekSelector`, `RingStage`, `Legend`, `StepsCard`, `HeartCard`, `SleepCard`. Colour, motion and cue timings live in `COLOR`, `MOTION` and `CUE`. Memoise every interpolation, start animations a frame after mount, clean up every effect, and take SVG ids from `useId`.

**Don't**
- Don't tint the page or the cards, colour the card icons, or give each sleep stage a hue. No coloured glows behind the content.
- Don't use a single linear gradient on a full circle (it seams), emoji icons or Apple's exact ring colours.
- Don't redraw the rings from zero when changing days, let any figure jump, or let any block pop in unanimated.
