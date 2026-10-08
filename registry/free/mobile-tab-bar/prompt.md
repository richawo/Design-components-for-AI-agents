Build a custom bottom tab bar for a fictional running app in React Native using core APIs only (`Animated`, `Pressable`, `View`, `StyleSheet`). It's dark and athletic, with acid-lime accents and a raised centre "record" button. Each tab switches a real, designed screen above the bar.

**Palette**
- Background `#0E0F0B`, surfaces `#1A1B16` and `#23241E`, hairlines `rgba(242,241,234,0.08)`.
- Text `#F2F1EA`, muted at 56%, accent lime `#D4FF3A`. Monospace (Menlo or monospace) for metadata.

**Bar**
- A floating rounded pill (radius 34pt) inset 16pt from the sides and bottom, on a raised surface with a hairline border and a soft shadow.
- Four tabs (Today, Routes, Club, You) with icons drawn from Views (a clock, a pin, bars and a person).
- The active tab's icon rises 7pt, a label fades in under it (spring stiffness 300, damping 22), and a short lime indicator bar on top slides between tabs (spring stiffness 320, damping 24).
- The centre: a 64pt lime circle raised above the bar with a play glyph. Tapping toggles recording: the glyph morphs to a stop square and a pulsing ring loops every 1.6s. The indicator hides while recording.

**Screens** (fade and rise 12pt over 320ms on switch, ease [0.2, 0.8, 0.2, 1])
- **Today:**
  - a mono date line ("TUE 7 OCT · WEEK 41") and "Morning, Adaeze." at 32pt, weight 800;
  - a weekly card: 32.4 km at 64pt, a lime progress bar towards the 40 km goal, and 7 day bars with today in lime;
  - a "Next up" workout card with a lime badge;
  - a shoe-mileage segmented bar.
- **Routes:** route cards, each with a mini elevation shape drawn from Views, distance and climb.
- **Club:** a leaderboard with your row highlighted.
- **You:** personal-best tiles.

**Accessibility**
- Tabs have `accessibilityRole="tab"` and `accessibilityState={{ selected }}`. The record button has a label that changes with state.
- Reduced motion disables the springs and the pulse.

**Don't**
- No icon fonts, emoji, default iOS tab bar look or more than one accent colour.

**Press feel**
- Every button, chip, plan card and row presses on a spring through a small `Squish` wrapper (an Animated Pressable): it scales to about 0.95 for buttons and 0.985 for rows and cards while held (stiffness 520, damping 30, native driver) and springs back on release. Scale carries the feedback, so any remaining opacity dim is kept light (85%).
- Under reduced motion the scale is skipped and only the colour or opacity change remains.
