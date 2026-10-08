Build a three-slide onboarding carousel in React Native using core APIs only (`ScrollView` paging, `Animated`, `Pressable`, `StyleSheet`, `useWindowDimensions`). It's for a fictional habit app, "Grove". Warm and confident: it should feel like a well-funded consumer app, not a template.

**Structure**
- A full-screen horizontal paging `ScrollView`, one slide per screen width.
- Top bar (54pt safe-area padding): the brand (a small leaf mark plus "grove" at 22pt, weight 800, tracking −0.8) and a "Skip" text button.
- Each slide shows an illustration in the upper half, built only from Views: circles, rounded rectangles and layered colour cards.
- Under it: a mono kicker ("01 / 03 — START SMALL"), a big headline (36–40pt, weight 800, letter-spacing −1.4, tight line height), and a body paragraph (16pt, 1.45 line height, ink at 75%).
- Bottom bar: the pagination indicator on the left and a 64pt round ink "next" button with a View-drawn arrow on the right. On the last slide it widens into a "Get started" pill.

**Colour**
- Each slide owns a background wash (peach `#FFDCC4`, sage `#D4E5CC`, butter `#F6E2A2`) and an accent (`#FF5B24`, `#1F6B45`, `#D9441E`).
- The background is interpolated from scroll position, so colours blend mid-swipe. Ink is `#1A1712`; cream cards are `#FFF8EE`.

**Illustrations**
- Each is a small layered composition: concentric rings around a seed, a calendar chain with one "rest token" link, or rising steps with a sticker.
- Cards tilt at most 3° for depth, never a scrapbook. Each layer translates at a different parallax rate from scroll offset (`shift(rate)`).

**Pagination**
- Dots that stretch: the active dot interpolates from 8pt to a 28pt pill while neighbours shrink, all driven by the scroll value (not by state), so it tracks the finger exactly.

**Interaction and accessibility**
- Next scrolls to the next page (animated), and Skip jumps to the last page or calls `onFinish` from there.
- Buttons have `accessibilityRole="button"` and labels; the carousel announces "Slide n of 3".
- Respect reduced motion (AccessibilityInfo): no parallax, instant page jumps.
- Use `useNativeDriver` on native and JS on web.

**Don't**
- No Expo libraries, SVG, Lottie, emoji, stock illustrations or default iOS grey.
- No more than 3° of tilt.

**Press feel**
- Every button, chip, plan card and row presses on a spring through a small `Squish` wrapper (an Animated Pressable): it scales to about 0.95 for buttons and 0.985 for rows and cards while held (stiffness 520, damping 30, native driver) and springs back on release. Scale carries the feedback, so any remaining opacity dim is kept light (85%).
- Under reduced motion the scale is skipped and only the colour or opacity change remains.
