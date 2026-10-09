Build a settings screen for a fictional journaling app, Folio, in React Native with core `Animated`/`PanResponder` plus `expo-blur`, `expo-linear-gradient` and `react-native-svg`. It should feel like Apple built it, in a dark-first monochrome: a large title that folds into a frosted nav bar, grouped inset sections on layered graphite surfaces, monochrome icon tiles, physical switches, a gliding segmented control, a snapping slider, a row that opens in place and a glass confirmation sheet. One accent (a prop) marks the switches, the slider, the selected time and Done; everything else is black, white and grey. The screen choreographs itself in: the title, the profile card (its numbers counting up, the avatar halo drawing), then each section, with below-the-fold sections waiting until they scroll into view.

**Layout**
- Stage `#0A0A0A` with one neutral radial glow from the top left (white at 7%) and a 4pt dot dither, scrolling up at half speed.
- Nav: absolute, 54pt status area + 44pt bar. A solid accent "Done" pill on the right (32pt tall, text in black or white, whichever reads on the accent).
- `Animated.ScrollView` with 98pt top padding and 16pt sides. Large title "Settings" 34/700, tracking −0.9.
- Profile card: a 68pt avatar (a 2pt halo ring around a 56pt light disc with ink initials), name, email, a neutral plan pill ("Folio Plus · renews 2 Mar") and a three-up stats strip (entries, day streak, words) split by hairlines.
- Groups 26pt apart: a 13pt uppercase header, a radius-20 card, an optional 13pt footer. Rows are 52pt minimum: a 30pt tile, 12pt gap, then the label column with an inset hairline separator (none on the first row).
- Groups: Reading (segmented paper picker, text size slider, a live preview card), Writing (Daily reminder switch; a Reminder time row that expands to four time chips and a "Weekdays only" switch; Writing prompts), Privacy & sync (Face ID, iCloud sync with a status light, Export journal), and a lone destructive row. A centred colophon closes the screen.

**Theme**
- `theme` prop, `"dark"` by default; `"light"` is a designed variant, not an inversion. Keep each palette in one token object and build one `StyleSheet` per theme from it.
- Dark: background `#0A0A0A`, ink `#F5F5F5`, secondary 60%, faint 36%, separators 8% white. Cards `#1A1A1A → #151515 → #121212` with an 8% hairline, an inset 6% top highlight and a deep shadow. Tiles `#3B3B3B → #262626` with a 14% inset top light and `#F2F2F2` glyphs. Switch track 16% white; segmented thumb `#3E3E3E → #2F2F2F`.
- Light: background `#F2F2F2`, ink `#111111`, secondary `#6B6B6B`, cards `#FFFFFF → #F9F9F9` with neutral (not warm) shadows, graphite tiles `#2E2E2E → #141414` with white glyphs, track `#E3E3E3`, a white thumb.
- Accent: one `accent` prop (default `#34C77B`) for switch fills, the slider fill, the selected time chip, Done, the sync light and the restore glyph. Text on the accent picks black or white by WCAG luminance.
- Semantic red `#E5484D` for the destructive row's glyph and title and the delete button only.
- Paper swatches and the preview keep their real colours (they depict paper): White `#FFFFFF`/`#1C1C1C`, Sepia `#F5EAD7`/`#4A3A28` with a warm radial sheen, Night `#1E1E1E`/`#E8E8E8`.
- No rainbow tiles, no tinted washes, no coloured plan pill or avatar ring.

**Glass**
- Nav: an `Animated` `BlurView` (intensity 100, tint follows the theme) plus an 82% → 66% background wash and a hairline. All fade in over the first 36pt of scroll (from 6pt). The small title fades in and rises 6pt between 30 and 48pt. Pulling down scales the large title to 1.12 from its left edge.
- Confirm sheet: inset 10pt, radius 34, `BlurView` 100 + a translucent graphite (or white) wash, a 1pt edge brighter on top, a deep soft shadow.
- Animate opacity on the `BlurView` itself, never on a parent: on the web a parent with opacity < 1 cancels the backdrop blur.

**Typography** (system font)
- Row labels 16, tracking −0.3. Values 16 in the secondary grey, tabular. Subtitles 13. Profile name 20/700. Stat values 18/700, tabular.
- The preview uses Georgia at the chosen size, line height 1.45, under an 11pt letterspaced date.

**Entrance choreography**
- Order: large title (0ms), Done (55ms), profile card (55ms), Reading (110ms), Writing (165ms); Privacy & sync, the destructive group and the colophon wait until they are 48pt into view, then arrive at once.
- Each section fades in, rises 12pt and clears an 8px blur over 520ms (`cubic-bezier(0.22,1,0.36,1)`); on iOS, where CSS blur doesn't render, it settles from scale 0.98 instead. At rest the transform and filter are dropped.
- Profile: 150ms after the card, the stats count up from zero over 680ms (tabular) while a 5px blur clears; the avatar halo draws clockwise from 12 o'clock over 720ms (`strokeDashoffset`); the plan pill pops in last with one small overshoot (spring 400/28).
- Reading: the slider fill and thumb run from the left end to 17pt over 480ms, 260ms after the section lands. Privacy: the sync light pops in.
- The whole first screen settles in under ~900ms. Every entrance is interruptible: grabbing the slider mid-entrance takes over at once.

**Motion**
- Rows: a 5–6% highlight fades in over 90ms and out over 320ms; the tile springs to 0.9 and back (700/40 in, 420/18 out). The profile card presses to 0.98.
- Switch (51 × 31): the knob springs across (520/26, one small landing overshoot) while the accent fill fades in. While held, the knob stretches 6pt toward the centre.
- Segmented control: the thumb glides on `spring.ui` (500/40) and squeezes to 0.95 while the selected segment is held. The preview's three paper layers crossfade over 340ms (ease-in-out).
- Slider (14–22pt): the thumb follows the finger 1:1, rubber-bands past the ends (0.35× and stiffening), and on release snaps to the nearest point carrying a little velocity (spring 420/30) with a 1.16 tick pulse. An inverse value bubble rises while dragging and leaves 260ms after release. Tapping the track jumps there. Step marks show only on the unfilled part. The preview text resizes live.
- Reminder time: height animates to the measured content (380ms ease-out open, 260ms ease-in-out close), content fades and drops 8pt, the chevron rotates 90°. Turning the reminder off collapses the row. Values and footers crossfade with a 4pt rise when they change.
- Delete: a scrim fades in and the sheet springs up (340/34). It can be dragged down 1:1 (resisted upwards) and dismisses past 120pt or a fast flick. Confirming swaps the label for a spinner in the same box; then the button turns accent with "Moved to Recently Deleted" and a check (1.04 overshoot) while the red trash disc crossfades to an accent check. The sheet leaves, the entry and word counts tween down to 0, and the row becomes "Restore 412 entries".
- Reduced motion: entrances become 150ms fades, numbers appear at their values, no springs, stretch or scale; height changes are instant and colour changes 120ms fades.

**Accessibility**
- Switches use `role="switch"` with `checked`, and the whole row toggles too. The segmented control is a tablist of tabs with `selected`. The slider is `adjustable` with min/max/now, a spoken value and increment/decrement actions. Chips are radios in a radiogroup. The expanding row reports `expanded`, and the confirm button reports `busy` while deleting. The large title is a header. Icons are SVG and hidden from screen readers.

**Don't**
- No rainbow icon tiles, no peach or sage washes, no second accent, no flat grey nav bar, no default switch, no lorem, no emoji icons, no row that cuts open, no section that pops in unanimated, no bounce beyond one small landing.
