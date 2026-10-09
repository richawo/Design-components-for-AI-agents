Build a settings screen for a fictional journaling app, Folio, in React Native with core `Animated`/`PanResponder` plus `expo-blur`, `expo-linear-gradient` and `react-native-svg`. It should feel like Apple built it: a large title that folds into a frosted nav bar, grouped inset sections on layered white surfaces, gradient icon tiles, physical switches, a gliding segmented control, a snapping slider, a row that opens in place and a glass confirmation sheet. Every touch gets an answer.

**Layout**
- Stage `#F2F1EE` with two soft radial washes (peach `#FBD3B8` top left at 75%, sage `#CFE6DA` top right at 70%) that scroll up at half speed.
- Nav: absolute, 54pt status area + 44pt bar. A "Done" pill on the right (32pt tall, green tint at 10%).
- `Animated.ScrollView` with 98pt top padding and 16pt sides. Large title "Settings" 34/700, tracking −0.9.
- Profile card: 68pt avatar (SVG ring in a `#F7C47B → #EE7E5C → #D8506E` gradient around an ink disc with initials), name, email, a plan pill ("Folio Plus · renews 2 Mar"), and a three-up stats strip (entries, day streak, words) split by hairlines.
- Groups 26pt apart: a 13pt uppercase header, a radius-18 card, an optional 13pt footer. Rows are 52pt minimum: a 30pt icon tile, 12pt gap, then the label column with an inset hairline separator (no separator on the first row).
- Groups: Reading (segmented paper picker, text size slider, a live preview card), Writing (Daily reminder switch; a Reminder time row that expands to four time chips and a "Weekdays only" switch; Writing prompts), Privacy & sync (Face ID, iCloud sync with a status dot, Export journal), and a lone destructive row. A centred colophon closes the screen.

**Glass**
- Nav background: an `Animated` `BlurView` (intensity 100, light) plus a `rgba(250,249,247,.62 → .42)` wash and a hairline at `rgba(40,36,30,.16)`. All three fade in from 0 over the first 36pt of scroll. The small title fades in and rises 6pt between 30 and 48pt. Pulling down scales the large title to 1.12 from its left edge.
- Confirm sheet: inset 10pt, radius 34, `BlurView` 100 + `rgba(255,255,255,.6 → .84)`, a 1pt edge brighter on top, a deep soft shadow.
- Animate opacity on the `BlurView` itself, never on a parent: on the web a parent with opacity < 1 cancels the backdrop blur.

**Typography** (system font)
- Row labels 16, tracking −0.3. Values 16 in `#6C6872`, tabular. Subtitles 13. Profile name 20/700. Stat values 18/700, tabular.
- The preview uses Georgia at the chosen size, line height 1.45, under an 11pt letterspaced date.

**Colour**
- Ink `#18171C`, secondary `#6C6872`, faint `#A9A6AE`, separators `rgba(60,58,67,.12)`. Cards `#FFFFFF → #FAF9F7` with a 7% hairline and a two-layer warm shadow.
- One accent, green `#21A06B` (highlight `#3CC287`), for switches, the slider, chips and Done. Destructive `#E5484D`.
- Icon tiles: a two-stop diagonal gradient per hue (amber, blue, coral, violet, green, sky, graphite, red) with a 28% white top sheen and 1.8-stroke white glyphs drawn in SVG.
- Papers: White `#FFFFFF`/`#1C1B1F`, Sepia `#F5EAD7`/`#4A3A28` with a radial warm sheen, Night `#1A1A1F`/`#ECE9E3`.

**Motion**
- Rows: a 6% ink highlight fades in over 90ms and out over 320ms; the icon tile springs to 0.9 and back (700/40 in, 420/18 out). The profile card presses to 0.98.
- Switch (51 × 31): the knob springs across (520/26, one small landing overshoot) while the green fill fades in. While held, the knob stretches to 33pt toward the centre.
- Segmented control: the white thumb glides on `spring.ui` (500/40) and squeezes to 0.95 while the selected segment is held. The preview's three paper layers crossfade over 340ms (ease-in-out).
- Slider (14–22pt): the thumb follows the finger 1:1, rubber-bands past the ends (0.35× and stiffening), and on release snaps to the nearest point, carrying a little velocity (spring 420/30) with a 1.16 "tick" pulse. A dark value bubble rises in while dragging and leaves 260ms after release. Tapping the track jumps there. The preview text resizes live.
- Reminder time: height animates to the measured content (380ms ease-out open, 260ms ease-in-out close), content fades and drops 8pt, and the chevron rotates 90°. Turning the reminder off collapses the row. The value crossfades with a 4pt rise when a chip is picked.
- Delete: a scrim fades in and the sheet springs up (340/34). It can be dragged down 1:1 (resisted upwards) and dismisses past 120pt or a fast flick. Confirming swaps the label for a spinner in the same box, then a green "Moved to Recently Deleted" with a check and a 1.04 overshoot. The sheet leaves and the entry and word counts tween to 0. The row becomes "Restore 412 entries".
- Reduced motion: no springs, stretch or scale. Height changes are instant and colour changes are 120ms fades.

**Accessibility**
- Switches use `role="switch"` with `checked`, and the whole row toggles too. The segmented control is a tablist of tabs with `selected`. The slider is `adjustable` with min/max/now, a spoken value and increment/decrement actions. Chips are radios. The expanding row reports `expanded`, and the confirm button reports `busy` while deleting. The large title is a header. Icons are SVG and hidden from screen readers.

**Don't**
- No flat grey nav bar, no default switch, no lorem, no emoji icons, no row that cuts open, no second accent colour, no bounce beyond one small landing.
