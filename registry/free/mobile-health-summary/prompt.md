Build a dark, luminous daily health summary in React Native (core `Animated`, `Pressable`, `ScrollView`) with `expo-blur`, `expo-linear-gradient` and `react-native-svg`. Its idea is the ring as an instrument: three concentric activity rings that draw themselves in, lap past 100% into a deeper shade, and can be isolated with a tap so the centre readout morphs to that metric.

**Layout** (390pt wide reference, 16pt side gutters, 58pt top padding for the status bar; scrolls)
- Header: an uppercase date line ("FRIDAY, 9 OCTOBER", 12pt, weight 600, tracking 1.1) over "Summary" (34pt, weight 700, tracking −1.1, line height 38). A 40pt initials avatar sits on the right inside a 1.5pt ring gradient (#FF3D6E → #FF8B52 → #1FD2F4).
- Week selector: a glass bar (radius 22) holding seven equal columns, each with a weekday letter (12pt, weight 700) over three 30pt mini rings. A glass pill (radius 16, top hairline brighter than the rest) glides between columns. Future days sit at 40% opacity, show empty tracks and are disabled.
- Rings: a 264pt square. Stroke 22, gap 3, outer radius 264/2 − 6 − 11. Tracks are the ring colour at 16% opacity. The centre holds a micro label ("TODAY" or the weekday, 10.5pt, weight 700, tracking 1.4), a 34pt tabular value with a 16pt muted suffix ("/3" or "%"), and an 11pt sub line ("rings closed", "+72 kcal over", "3 hr to go").
- Legend: three columns under the rings: a 12×4 gradient swatch, the label, then the value (19pt, weight 700, ring colour) with "/540 KCAL" muted. These columns are also the accessible ring buttons.
- Cards (10pt gaps, radius 24, 16pt padding): Steps (flex 1.18) with value, "6.1 km · goal 10,000" and a 34pt sparkline of hourly steps. Heart (flex 1) with resting bpm, range and a beat line. Sleep (full width) with asleep time, "IN BED 23:12 – 06:41", a 10pt stacked bar (Deep, Core, REM, Awake, 2pt gaps, radius 3) and a 4-column key.

**Rings, drawn properly**
- SVG has no conic gradient. Split each lap into two half arcs, each with its own `userSpaceOnUse` vertical gradient (right half: start colour → midpoint, top to bottom; left half: midpoint → end colour, bottom to top). The result reads as a sweep. Mask both with a full circle path that starts at 12 o'clock, with round caps and `strokeDasharray = circumference`, and animate `strokeDashoffset` to show progress. Paint a start-colour dot at 12 o'clock so the start cap isn't the end colour.
- Second lap: the same construction with a deeper gradient (Move #B3123F → #D4521F), driven by progress 1→2.
- Tip: an RN View rotated by `progress × 360°` carries a stroke-sized dot at the top. Its colour is interpolated from progress so it matches the gradient exactly where the arc ends (sample the two-half gradient at 24 points per lap). It has a soft glow in the ring colour and a forward shadow (`3px 0 7px rgba(0,0,0,.6)` past 100%), so the second lap visibly overlaps the first, as on a real watch.

**Colour**
- Background: #0B0C12 → #0E1018 → #08090D, with four radial glows at 14–20% (rose #FF3D6E top left, cyan #1FD2F4 right, blue #4C94FF bottom left, amber #FF8B52 bottom right) and a 4×4 dither pattern of 1px dots at 3–5% so the gradients never band.
- Rings: Move #FF3D6E → #FF8B52, Exercise #7DEB3A → #D9FF5C, Stand #1FD2F4 → #62A6FF. Ink #F4F5F8, secondary rgba(235,238,245,.56), faint .34.
- Sleep: Deep #4B57E6, Core #4C94FF, REM #6FE2DD, Awake #FFB27A.
- Glass: `BlurView` (intensity 42, dark) + a 3-stop white gradient (8.5% → 3% → 1.5%) + a 1px border at 5.5% with the top edge at 17%, and an outer shadow `0 18px 40px -18px rgba(0,0,0,.7)`.

**Motion**
- Mount: header, week, rings and cards rise 14pt and fade in, staggered 60ms (620ms, ease-out 0.22,1,0.36,1). Glass fades each of its layers rather than a wrapper: on the web an ancestor with opacity below 1 cuts the backdrop blur off. After 280ms the rings draw in, staggered 140ms, over 1250ms + 250ms per lap. The sparkline draws in (900ms) and its fill and end dot arrive as it finishes. The sleep bar grows from 60% scale.
- Switching days: the pill springs (stiffness 500, damping 40). Rings ease (0.65,0,0.35,1, 820ms, stagger 70ms) from where they are to the new values, never from zero. Every number tweens with tabular figures, the date line crossfades with a 5pt rise, the sparkline redraws and the sleep segments re-flex.
- Isolating: tap a ring (hit-tested by distance from the centre, using the touch point captured on press-in) or its legend column. The others dim to 10% and scale to 0.985, a halo in that ring's colour fades in around the rings (a radial gradient that's transparent inside and peaks at 68%), the label crossfades and the value tweens to the percentage. Tap it again, or the centre, to return.
- Heart: a 46pt bright comet runs along a dim ECG path at the resting rate (the component's one ambient loop).
- Every Pressable springs to 0.9–0.97 and back with a little overshoot.
- A 50pt status-bar scrim and a 36pt home-indicator scrim (gradients to the background) dissolve scrolled content instead of clipping it.
- Reduced motion: values are set instantly, the beat line is static and crossfades are instant.

**Accessibility**
- Week days are tabs with selected and disabled state. The ring area is one button whose label reads all three values, and legend columns are buttons with selected state. The sleep bar has a spoken summary.

**Don't**
- Don't use a single linear gradient on a full circle (it seams at the bottom), a flat grey glass box, emoji icons or Apple's exact ring colours.
- Don't redraw the rings from zero when changing days, and don't let numbers jump.
