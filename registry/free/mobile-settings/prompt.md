Build a grouped settings screen in React Native using core APIs only (`Animated`, `Pressable`, `ScrollView`, `View`, `StyleSheet`). It's for a fictional writing app, "Folio", with warm linen by day and espresso by night. The appearance control actually crossfades every colour on the screen.

**Palettes** (every colour animates between the two)
- Light: bg `#F4EEE4`, card `#FFFCF7`, ink `#2B2420`, sub `#857868`, line `#ECE3D6`, chip `#F1E8DB`, accent `#C4572E`, accentSoft `#F5DFD2`, track `#E3D8C8`, danger `#B4321F`.
- Dark: bg `#191512`, card `#241F1B`, ink `#F3EBE0`, sub `#A69885`, line `#342D27`, chip `#2F2823`, accent `#E2794C`, accentSoft `#3D2A20`, track `#3D352E`, danger `#F07A62`.
- Put a single `Animated.Value` (0 = light, 1 = dark) in context, and have each style interpolate its colour from it.

**Layout** (54pt top padding)
- Header: "Settings" at 34pt, weight 800, letter-spacing −1.2, with a "Done" text button in the accent.
- Profile card:
  - a 64pt initials avatar with an accent "+" badge, the name (20pt, weight 800), email and plan chip;
  - a chevron;
  - a 3-up stats row (entries, day streak, words) separated by hairlines.
- Groups with uppercase micro headings (12pt, weight 700, tracking 1.2, sub colour): Appearance, Writing, Privacy & data, Account.
- Each row has a 32pt icon chip (icons drawn from Views: bell, notebook, lock, "Aa"), a label, an optional detail line, then a value with a chevron or a switch. Rows are separated by inset hairlines.
- Appearance: a 3-option segmented control (Light / Dark / Auto) with a sliding thumb and small View-drawn glyphs (sun, moon, half-disc), plus a caption that changes with the mode ("Ink on linen, like a good notebook.").
- A destructive "Sign out" row in the danger colour, and a centred version footer.

**Switch** (custom)
- A 51×31 track that animates from the track colour to the accent, with a thumb springing across (stiffness 380, damping 30).
- `accessibilityRole="switch"` with `accessibilityState={{ checked }}`.

**Accessibility and motion**
- Every row is a Pressable with a role and label, and the segmented control exposes radio semantics.
- With reduced motion, theme changes and switches are instant.

**Don't**
- No stock iOS grey (#F2F2F7), SF Symbols assumptions, emoji icons or external switch components.
