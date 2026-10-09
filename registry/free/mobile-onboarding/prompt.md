Build a four-step onboarding pager in React Native for a fictional focus app, "grove", where swiping moves one day forward: dawn, morning, afternoon, golden hour. Use `Animated`, `PanResponder`, `expo-blur`, `expo-linear-gradient` and `react-native-svg`, with nothing else. One `Animated.Value` called `pos`, measured in pages, drives everything. Each layer reads that one number, so the whole scene answers the finger in the same frame.

**Layout** (390×844 reference; measure with `onLayout`)
- **Sky:** full-bleed. One `LinearGradient` per step (three stops at 0 / 0.48 / 0.82), stacked. Layer `i` has opacity `clamp(pos − (i − 1), 0, 1)`, so mid-drag the colour is a true linear blend rather than a double-exposed crossfade.
- **Top bar:** `top: 54`, 44pt tall, 16pt side padding.
  - The brand is centred: a two-leaf SVG mark (22pt) and "grove" at 20pt, weight 700, tracking −0.7.
  - Left is a 40pt glass circle with an SVG chevron (Back). It fades in and slides 8pt across `pos` 0→1.
  - Right is a 40pt glass "Skip" pill (15pt, 600). It fades out on the last step.
- **Card:** a glass card 12pt from the sides and bottom, 336pt tall (304 under 760pt), radius 32. Inside, 24pt horizontal padding and 22pt at the top:
  - the progress indicator on the left and a mono clock on the right;
  - the copy area (flex 1; mono kicker, title, body);
  - a 56pt pill button.
- **Scene:** fills the space above the card.
  - Horizon (far ridge base) sits 146pt above the card. The middle hills sit at 100pt and the near meadow at 56pt.
  - The meadow runs down behind the card, so the glass has real colour to blur.
- **Chips:** one floating glass chip per step, 84pt or 132pt above the horizon. It sits right on steps 1–2 and left on 3–4, opposite the sun. Each is auto-width (max 300pt) with 12/14pt padding and radius 22.

**Illustration** (all SVG, ids from `useId`)
- **Sun:** a 420pt `RadialGradient` glow (stops 1 / 0.8 / 0.36 / 0.1 / 0) around a 22–29pt disc with a white hairline.
  - Three tinted versions (dawn `#FFE0C6`, day `#FFF8E2`, gold `#FFC27E`) crossfade with `pos`.
  - The sun travels an arc: x = 22% → 80% of the width, y = horizon − 34 − sin(πt)·150.
- **Hills:** three silhouettes built from summed sines (sampled every 6pt), each with a 1pt light rim on the crest.
  - Each layer is drawn once per step's `land` colour and crossfaded like the sky.
  - Gradients: the far ridge fades toward white at the base (haze), the middle hills darken 30% toward ink, and the meadow has a sunlit lip that darkens 62% toward the bottom.
- **Parallax:** rates per page are clouds 0.12, far 0.22, middle 0.48, near 0.8, chips 1.12 and copy 0.32 of the width. Every layer is padded by 0.62 × its travel at both ends, so rubber-banding never shows an edge.
- **The grove:** 13 trees on the meadow (round canopies of three radial-gradient circles, or pines with a soft highlight stroke).
  - Each grows from the bottom (`translateY(H/2) scale translateY(−H/2)`) as `pos` approaches its page (from page − 0.75 to page − 0.05).
  - The first sapling grows from 0.55 to 1 across step 1.
- **Lighting:** a rose wash over the land fades out after dawn, and an amber wash fades in for golden hour.
- **Grain:** a 96pt SVG pattern of 220 scattered 1pt dots (white at 10%, ink at 4.5%) over everything, to stop banding.

**Typography**
- **Kicker:** mono 11pt, tracking 1.4, uppercase, `#7A5A3E`.
- **Title:** 32/35, weight 700, tracking −1.1 (28/31 compact).
- **Body:** 16/23 at 66% ink.
- **Chip:** value 16pt/700 with tabular numerals; label 12.5pt/500.
- **Clock:** mono 12pt, tabular. Its minutes tween with the drag (06:10 → 09:30 → 15:45 → 19:20).
- **Button:** 17pt/600, tracking −0.3.

**Colour**
- **Ink:** `#14201A`.
- **Skies:** dawn `#E9BFB9 → #F5D7C7 → #FCEBDC`, morning `#F1DFB4 → #F7EBCB → #FBF5E3`, afternoon `#9FC9DA → #C9E2E4 → #F1F0DD`, golden `#EE9C6C → #F6C597 → #FCE3C2`. Neighbours are chosen so their RGB midpoints stay warm, never grey.
- **Land** (far / mid / near): dawn `#C99FA3 #93A68A #4E7C5C`, morning `#BDB8A0 #86A783 #4A8259`, afternoon `#93B4BD #6E9E80 #3E7752`, golden `#D49479 #9C9862 #56784A`.
- **Glass:** `BlurView` (light tint; intensity 30–36 on chips, 60 on the card).
  - A warm wash `rgba(255,252,247,0.86) → rgba(255,249,241,0.72)` on the card, white 58% → 26% on chips.
  - A hairline at 50% white, plus an inset edge light `0 1px 0 rgba(255,255,255,0.85)` on top and a faint ink line at the bottom.
- **Button:** ink gradient `#24352C → #121C17` with an inset top highlight. On the last step it crossfades to grove green `#2F5E45 → #1C3A2B` with an amber glaze, and it turns `#3E7A57` once planted.

**Motion**
- **Drag:** follows the finger 1:1. Past either end it rubber-bands as `(1 − 1/(o·0.55 + 1)) · 0.6` pages. On release it projects `pos + v·0.22s` (v in pages per second), snaps to at most one page from the start, and springs with stiffness 320 and damping 30, carrying the release velocity.
- **Taps:** Continue and Back animate `pos` over 560ms ease-in-out `(0.65, 0, 0.35, 1)`. Skip takes 760ms and passes through every sky on the way.
- **Progress:** the indicator is built only from transforms, for the native driver. Each dot is two 7pt caps and a 10pt bar scaled on X. Widths go 7 → 26 → 7 around each page, with x offsets from a running `Animated.add`, and the active dot runs at 100% opacity against 22% for the rest. The dots stretch into a pill and pass it along mid-drag.
- **Copy:** each step's text slides at 0.32 of the width and fades out by ±0.55 pages, clipped at the card edge.
- **Entrance:** 760ms ease-out. The hills rise 10/18/28pt, the sun 24pt, the chips 14pt and the card 28pt.
- **Ambient:** the breath chip's dot inhales (scale 0.7 ↔ 1.15, 2.4s each way) only while its step is active. Nothing else loops.
- **Press:** 90ms to scale 0.97, then a spring back (stiffness 420, damping 22) with a hair of lift.
- **Finish:**
  - The final tree springs up once (stiffness 200, damping 17) behind a gold glow and gets five blossom dots.
  - Fourteen SVG leaves (green and amber, 20pt) burst in a 170° fan over 1.1s. Their positions ease out, they fade over the last 40%, and they come with a blooming amber ring and halo.
  - The label crossfades out by 35% of the way through, then "Planted. See you at 7:30" rises 8pt in with a drawn check. `onFinish` fires at 1.1s.
- **Native driver:** used on native for everything (transforms and opacity only); the JS driver is used on web.
- **Reduced motion:** no parallax (the land stays still and the grove spreads across one window), page changes in 140ms, no entrance travel, no breathing and no burst.

**Accessibility**
- Back, Skip and the main button have `accessibilityRole="button"` and labels; the main button gets `disabled` state once planted.
- The copy area is `accessibilityRole="adjustable"`, labelled with the current title and body, with value "Step n of 4" and increment/decrement actions that page.
- Decorative SVG sits in `aria-hidden` wrappers. The planted state is announced.

**Don't**
- No Lottie, images, emoji, icon packs, Reanimated or gesture-handler.
- No two-colour rainbow skies, purple-to-blue gradients or neon glows.
- No pagination that jumps (it must morph with the finger).
- Don't animate `width` (use transforms), and never let a parallax layer's edge show while overscrolling.
- No confetti, and nothing bounces more than once.
