# Mobile builder brief: Design for AI (React Native)

You are rebuilding or creating React Native components for **Design for AI** (design.yaps.ai), a premium, paid component library. The owner's verdict on the current mobile set: *"all of the mobile examples seem basic. No real glassmorphism, or textured subtle gradients, smooth animations, attention to detail, polished above and beyond transitions."* Your job is to change that verdict. These must feel like the best iOS apps (Apple's own apps, Things, Linear mobile, Arc Search, Revolut, Airbnb, Robinhood, Spotify, Opal, Flighty, Crumbl, Cash App): physical, layered, luminous, every touch answered.

## What changed
Mobile components may now use, in addition to `react` and `react-native` core:
- `expo-blur` → `BlurView` (real backdrop blur: `intensity`, `tint`). Use it for glass that sits over *moving or colourful* content, where blur is visible and meaningful.
- `expo-linear-gradient` → `LinearGradient` (surfaces, sheens, light edges, fades, text-safe scrims).
- `react-native-svg` → `Svg`, `Path`, `Circle`, `Rect`, `Defs`, `LinearGradient`/`RadialGradient`, `Stop`, `G`, `ClipPath`, `Mask` (icons, illustrations, rings, charts, glows). Draw every icon yourself in SVG (24px grid, 1.6–1.8 stroke, round caps), never Unicode-box icons or emoji.

Nothing else: no Reanimated, gesture-handler, Skia, other Expo modules, icon packs or images. Animate with `Animated` (`useNativeDriver: true` for transform/opacity; JS driver only where needed), drag with `PanResponder`, `Easing` curves, springs. `boxShadow` strings ("0 10px 30px rgba(...), inset 0 1px 0 rgba(...)") work in RN 0.76+ and in the previews. Use them for layered depth and light edges.

## The bar (in addition to docs/COMPONENT_SPEC.md)
- **Glass done right:** a `BlurView` with a 1px hairline highlight edge (top lighter than bottom, via a thin `LinearGradient` border or `boxShadow` inset), a faint inner gradient, and real colour behind it so the blur reads. Never a flat translucent grey box.
- **Textured, subtle gradients:** surfaces have 2–4 stop gradients with low contrast, soft radial glows (SVG `RadialGradient`), and optionally fine noise or dither (e.g. an SVG pattern of tiny dots at 3–5% opacity) to stop banding. Avoid garish two-colour gradients.
- **Motion:** every press gets a spring (scale 0.96–0.98 with a little lift back), every state change is a continuous transition (shared elements move and morph between states; content crossfades with a small offset). Entrances stagger subtly (40–70ms). Drags follow the finger 1:1 with rubber-banding at limits and velocity-aware release. Nothing cuts, nothing pops without easing, nothing bounces more than once.
- **Detail:** real status-bar-safe layout (pad ~54pt top in the demo), tabular numbers that tween, haptic-feeling micro-moments (a tiny overshoot on confirm, a tick on snap), considered empty/loading/error/success states, accessibility roles/labels/states on every Pressable, reduced motion respected (`AccessibilityInfo.isReduceMotionEnabled`).
- **Specific, believable content** for a fictional but plausible app. No lorem, no "Item 1".
- **One focused component**, not a whole app: a screen or a part, with the minimum context to show its behaviour.

## Where and how
- Repo: `/home/user/Design-components-for-AI-agents`. Free: `registry/free/<slug>/`, Pro: `registry/pro/<slug>/`. Files: `<slug>.tsx`, `meta.json`, `prompt.md`, `prompt.json` (see the spec and the existing mobile components for format; `"platform": "mobile"`, `"category": "mobile"`, list the libraries you use in `"dependencies"`, `"added"`/keep original date for rebuilds, `previewHeight` ~940).
- Rebuilds keep the **slug, tier and the core idea** but you're free to reconceive the visual design, copy and interactions completely to reach the bar. Rewrite prompt.md/prompt.json to match.
- Default export: the component at full size with zero props. The site renders it inside a 390×844 phone frame (and full-screen on narrow viewports). Named export + props type as per spec.
- Only touch your own slug folders. Don't touch site code, `package.json`, git, or other components. Don't commit. Don't start/stop servers.
- Dev server: `http://localhost:3100` (already running). After creating files: `node scripts/build-registry.mjs`. Preview: `/preview/<slug>`. Typecheck: `npx tsc --noEmit`.
- Screenshots: `node scripts/shot.mjs <slug> --out=<scratch> --wait=3000` (mobile captures 390×844). For states and mid-transition frames, write throwaway Playwright scripts (import from `/home/user/Design-components-for-AI-agents/node_modules/playwright-core/index.mjs`; `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`; viewport 390×844, `deviceScaleFactor: 2`, `hasTouch: true`; use `waitUntil: "load"`). Drive taps and drags (`page.mouse.down/move/up` or touchscreen). **Look at every screenshot** at 2x and critique it like a demanding product designer at Apple. Iterate until it's genuinely excellent: if it looks like a template, it isn't done.
- Scratch dir: `<scratch>/<your-agent-name>/`.

## Report back
For each component: slug and tier, the signature detail, the states/transitions you verified (and how), any compromises, and paths to the final 390×844 screenshots (rest state plus 2–3 key states).
