# Component spec

Every Design for AI component is held to this document. It exists because the
library's whole promise is *premium craft*: one generic, half-finished or broken
component undoes the rest. If a component can't meet this bar, it doesn't ship.

---

## 1. Files

A component is a folder named after its slug (kebab-case, unique across the
whole library) in `registry/free/` or `registry/pro/`:

```
registry/free/chart-portfolio/
  chart-portfolio.tsx   the component (one file, self-contained)
  meta.json            metadata for the site, SEO and the shadcn registry
  prompt.md            a natural-language prompt that rebuilds the component
  prompt.json          the same brief as structured JSON
```

After adding or changing a component, run `node scripts/build-registry.mjs`.
Broken components are skipped (and reported) in dev; `--strict` fails CI.

### `<slug>.tsx`

- **One file. Self-contained.** No imports from the site, from other
  components, or from relative paths. A user should be able to paste the file
  into any React 19 + Tailwind v4 project and have it work.
- **Allowed imports (web):** `react`, `motion/react`, `lucide-react` and `three`
  (plain Three.js; no react-three-fiber). Nothing else. List any you use in `meta.dependencies`.
- **Allowed imports (mobile):** `react`, `react-native` core APIs (`View`,
  `Text`, `Pressable`, `ScrollView`, `TextInput`, `Animated`, `PanResponder`,
  `StyleSheet`, `useWindowDimensions`, `Easing`, …) and three widely used
  libraries that render in Expo, bare React Native and the web previews:
  - `expo-blur` (`BlurView`) for real frosted glass over content;
  - `expo-linear-gradient` (`LinearGradient`) for surfaces, sheens and fades;
  - `react-native-svg` for icons, illustrations, rings, charts and radial
    gradients. Draw icons yourself with it; no icon packages.
  Nothing else: no Reanimated, gesture-handler, Skia or other Expo modules.
  Animate with `Animated` and `useNativeDriver: true` wherever the property
  allows it, and drag with `PanResponder`. List the libraries you use in
  `meta.dependencies`. No emoji as icons. Bare React Native apps need
  `npx install-expo-modules` once for the two Expo packages; say so in usage.
- **Mobile is held to the same premium bar as web, not a lower one:** real
  glass where it earns its place (a `BlurView` over moving content, a
  hairline light edge, a faint inner gradient), layered surfaces with soft
  coloured shadows (`boxShadow` strings work in React Native 0.76+), subtle
  textured gradients rather than flat fills, springs on every press, and
  continuous transitions between states (shared elements move, nothing cuts).
- **Default export renders a complete, beautiful demo with zero props.** Also
  export the component by name (`export function HeroEditorial`) and its props
  type (`export type HeroEditorialProps`).
- **Every piece of content is a typed prop with a realistic default.** Arrays
  of items (plans, testimonials, nav links) are props too.
- `"use client"` at the top when the component uses state, effects, refs or
  event handlers (web only; omit it for mobile).
- **Colours:** Tailwind's default palette or arbitrary values (`bg-[#f4f0e8]`).
  Never `site-*` tokens: those belong to the website, not to components.
- **Fonts:** only `font-display`, `font-serif`, `font-sans` and `font-mono`.
  These roles come from `public/r/theme.json`: Geist (display), Instrument Serif,
  Geist and Geist Mono. Mobile components use the system font and
  don't set `fontFamily`, except `fontFamily: "Menlo"`/monospace where mono is
  the point.
- **Keyframes:** Tailwind ships `spin`, `ping`, `pulse` and `bounce`. For
  anything else use `motion/react`, or render a `<style>` tag inside the
  component with keyframes namespaced to the slug (`@keyframes
  tm-logo-marquee-scroll`).
- **SVG ids:** `<defs>` ids must come from `useId()` (or be namespaced by
  slug) so two instances on a page don't collide.
- **Images:** no network images or stock photography. Build the visuals: CSS,
  inline SVG, gradients used sparingly, real-looking UI drawn in markup,
  initials avatars, abstract patterns. This is a feature: components work
  offline and never ship broken image links.
- **No `any`.** TypeScript strict. No unused variables.

### `meta.json`

```json
{
  "slug": "chart-portfolio",
  "name": "Portfolio Chart",
  "tier": "free",                       // "free" | "pro" (must match the folder)
  "platform": "web",                    // "web" | "mobile"
  "category": "hero",                   // see lib/registry-types.ts CATEGORIES
  "description": "80–170 characters. Concrete: what it looks like, who it's for.",
  "tags": ["hero", "landing page", "editorial"],   // ≥ 3, lowercase, searchable words
  "dependencies": ["motion"],           // npm deps beyond react/react-native
  "theme": "light",                     // dominant surface: "light" | "dark"
  "previewHeight": 860,                 // preview frame height at desktop, px
  "usage": "import { X } from \"@/components/design-for-ai/x\";\n\n…",
  "props": [{ "name": "lead", "type": "string", "default": "\"…\"", "description": "…" }],
  "added": "2026-10-07"
}
```

Mobile components use `"category": "mobile"` and are imported from
`@/components/design-for-ai/native/<slug>` in `usage`.

### `prompt.md`

The prompt an agent pastes to **rebuild or adapt** the component from scratch.
Write it the way a design director briefs a senior engineer:

1. One-sentence intent, including the stack (React + Tailwind v4 +
   motion/react, or React Native core).
2. **Layout:** structure, measurements, the grid and how it collapses.
3. **Typography:** exact sizes (clamp values), weights, tracking, leading.
4. **Colour:** exact hex values and where each is used.
5. **Motion:** what moves, durations, easing, triggers, reduced-motion fallback.
6. **Accessibility:** roles, labels, keyboard and focus behaviour.
7. **Don't:** what would turn it into slop.

Specific numbers beat adjectives. "Tracking −0.05em, line-height 0.92" says
more than "tight, bold headline".

### `prompt.json`

The same brief as data, for agents that work better with structure. Required
keys: `component`, `intent`, `platform`, `stack`, `layout`, `typography`,
`color`, `motion`, `responsive`, `accessibility` (string array), `content`, and
`avoid` (string array). Use `registry/free/chart-portfolio/prompt.json` as the
model.

---

## 2. The taste bar

The library is a reaction against "AI slop": the instantly recognisable look of
UIs that a model generated with no direction. Every component has to be
something a senior product designer would put in their portfolio.

### Do

- **Be one focused component, not a page.** A pricing component is the
  pricing; a header is the header. No marketing headline, filler sections or
  fake website around it. The default export may place the component on a
  quiet stage (plain dark or light background, centred, generous padding) and
  may add the minimum context needed to show its behaviour (for example, a
  short scrollable area under a header that condenses on scroll), but the
  stage is never part of the component's API. If it could be split into two
  components, split it.
- **Feel premium.** Precise typography, layered depth (hairline borders, inner
  highlights, soft deep shadows), restrained colour, purposeful light and
  texture. Playful components are welcome, but they have to be polished
  rather than childish.
- **3D and canvas work stays light.** Cap devicePixelRatio at 2, pause
  offscreen (IntersectionObserver), render one static frame with reduced
  motion, and dispose of everything on unmount.

- **Have a point of view.** Every component has an idea: a receipt-style
  pricing table, a kinetic headline, an agent timeline that feels like a flight
  log. Generic is a defect.
- **Use a real typographic scale.** Make big type big (display headlines at
  `clamp()` up to 6–9rem) with tight tracking (−0.03 to −0.06em) and leading of
  0.9–1.05 on display sizes. Body runs at 15–18px, leading 1.5–1.7, measure
  45–70ch. Mono, small and uppercase, carries metadata.
- **Monochrome first.** These are general components that people restyle,
  so the default palette is black, white and greys: true black or near-black
  surfaces, neutral greys, white ink (or the light inverse). Colour is an
  intentional divergence, used only where it carries meaning: one strong
  brand accent on the primary action or the selection, the colour of the
  thing the content depicts (a payment card, an album cover, an activity
  ring, a map route), data series, and semantic states (success, error). If
  a colour isn't doing one of those jobs, it's grey. Expose the accent as one
  prop or token so a user rebrands in one place. Contrast meets WCAG AA.
- **Polish the whole frame, not just the subject.** Everything visible is
  held to the same bar as the thing the component is named for. The
  content around a tab bar, a sheet or a header is never filler: it is
  choreographed like the component itself. On first view, and on every
  tab or view switch:
  - blocks stagger in (opacity, 8–16px rise, a 6–8px blur that clears;
    40–70ms apart), in reading order;
  - numbers count up from zero (or from their previous value) with
    tabular numerals and a light blur that clears as they land;
  - charts draw: lines stroke in, bars grow from the baseline, rings and
    avatar rings draw along their path;
  - progress bars and meters fill once their block has landed, not before;
  - the order is containers, then text, then figures, then data and
    progress, so the eye is led rather than flooded.
  Every view a component can show (each tab, each step, each state) gets
  this treatment, not only the first one.
- **Use space as a material.** Generous, deliberate whitespace. Stick to a
  4/8px rhythm and align everything to something.
- **Make motion meaningful.** Animate to explain state, guide attention or
  reward interaction. Use ease-out curves such as `[0.2, 0.8, 0.2, 1]` at
  200–700ms, and spring physics for anything that's dragged.
- **Sweat the details.** Hover, focus-visible, active, disabled, loading,
  empty and error states. Use tabular numbers for figures, real punctuation
  (’ “ ” — ×) and optical alignment of icons.
- **Write real copy.** Make it specific, human and slightly witty, with
  fictional but plausible brands, names, numbers and dates. Never lorem
  ipsum, never "Feature 1".

### Never (the slop list)

- Purple-to-blue gradients, gradient text on headlines, and the
  "AI-gradient blob" behind the hero.
- Glassmorphism as a default, or a glow around everything. Colour as
  decoration: rainbow icon tiles, a different hue per card, tinted
  backgrounds that don't mean anything.
- A centred hero with a pill badge saying "✨ Introducing …".
- Emoji as icons or bullets. Sparkle icons for "AI".
- Three identical feature cards with an icon in a rounded square, a title and
  two lines of grey text.
- "Unlock", "Supercharge", "Revolutionise", "Seamless", "Elevate",
  "Effortless", "Next-generation", "Leverage" or "in today's fast-paced world".
- `rounded-2xl` on everything at the same radius with `shadow-lg` on top.
- Inter-at-default-tracking everything. Grey-on-grey low-contrast text.
- Placeholder avatars from pravatar or unsplash. Any network image.
- Fake precision with no design intent: random stats, random badges.

---

## 3. Interaction and feel

A component is judged in motion, not in a screenshot. Every component should
feel calm, immediate and physical: it answers the pointer within a frame,
moves only when there is a reason, and never fights the person using it.
Minimal is not the same as static. The polish is in the states.

### Motion tokens

| Token | Value | Use |
| --- | --- | --- |
| `ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entrances, state changes, anything arriving |
| `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | morphs and things travelling across the screen |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | exits only |
| micro | 120–160ms | hover, press, colour, icon nudges |
| small | 180–240ms | toggles, tooltips, popovers, tabs |
| medium | 280–420ms | panels, drawers, chart morphs, accordions |
| large | 500–800ms | first-view reveals and section entrances |
| `spring.ui` | stiffness 500, damping 40 | selection pills, indicators, layout moves: snappy, no bounce |
| `spring.drag` | stiffness 320, damping 30, carry release velocity | anything dragged, flung or thrown |
| `spring.soft` | stiffness 180, damping 22 | magnetic pulls, cursor followers, tilt |

Exits run at about two thirds of the entrance duration. Playful components
may show one visible overshoot; nothing else bounces.

### Every interactive element has all of these

- **Hover** (pointer devices only): one clear step, not three. The surface
  lifts by 3–4% white (or darkens on light), the text goes to full strength,
  and directional icons nudge 1–2px toward the action. Micro duration.
- **Press:** scale 0.97–0.98 for buttons and cards (or 1px down for pills),
  80–100ms in, springing back on release. Colour alone is not press
  feedback. Press feedback is mandatory on touch.
- **Focus-visible:** a 2px ring offset against the surface it sits on, shown
  instantly (no transition on the ring), keyboard only, never on click.
- **Selected:** indicators travel between options with a shared layout
  animation (`layoutId`) on `spring.ui`. They never jump.
- **Disabled:** 35–45% opacity, `cursor-not-allowed`, no hover response.
- **Loading and success:** the control keeps its size; a spinner, progress
  or check replaces the label inside the same box, then settles back.
- **Empty and error:** designed, written and animated like any other state.

### Feel rules

1. **Respond within a frame.** Hover and press feedback has no delay.
   Tooltips are the only delayed thing: 300–500ms to open, instant to close,
   instant when moving between neighbours.
2. **Nothing moves unless the user caused it,** except one ambient signal
   per component (a live dot, a slow drift, a ticking value), which pauses
   offscreen and in hidden tabs.
3. **Everything is interruptible.** State animations use motion values or
   springs, so a reversed hover or a second click reverses mid-flight
   instead of finishing first. CSS keyframes are for ambient loops only.
4. **Continuity over cuts.** Elements that persist between states morph
   (layout animation). Swapped content cross-fades with a 4–8px offset and a
   2–4px blur, so the eye can follow it.
5. **Numbers count.** Changing figures tween to their new value with
   tabular numerals; they never jump or reflow.
6. **Surfaces know where the pointer is.** Cards and panels may carry a
   pointer-tracked spotlight or edge light (a radial gradient at 6–10%
   white). Primary actions may pull magnetically, at most 6–8px and at most
   one per view.
7. **Reveal once.** Scroll reveals run once, at 20–30% visibility, with a
   12–24px offset over 500–700ms and a 40–80ms stagger. Nothing
   re-animates on the way back up.
8. **Touch is first-class.** Every hover reveal has a tap equivalent. Drags
   use pointer capture and the right `touch-action`, and never trap the
   page's vertical scroll.
9. **No theatre.** No rotate-ins, no bouncing entrances, no infinite pulses
   on content, no animation longer than 800ms that the user has to wait for.
10. **Reduced motion keeps meaning.** Opacity changes stay (150ms or less);
    transforms, parallax, magnetism, tilt and loops go.

### Checking the feel

Record it. `node scripts/rec.mjs <slug> --steps="..."` drives the preview
with a pointer and keyboard and writes a video and a GIF, so hover, press,
focus and state changes can be reviewed frame by frame. A component isn't
done until its recording feels right at full speed.

## 4. Responsive by default

- **Respond to the container, not the viewport.** Put `@container` on the root
  and use container variants (`@md:`, `@2xl:`) so a component works in a
  sidebar column as well as full width. Measure canvases and SVGs with
  ResizeObserver.
- Must look intentional at **320, 390, 768, 1024, 1440 and 1920px** wide.
  Not "doesn't break": *designed* at each size.
- **Zero horizontal overflow at any width.** The screenshot tool flags it.
- Touch targets are at least 44×44px on mobile, and nothing depends on hover
  alone: hover reveals have a tap or always-visible equivalent on touch.
- Tables become cards or scroll inside their container on small screens.
- Use `clamp()` for display type. Don't make text tiny to fit.
- Mobile (React Native) components use `useWindowDimensions` or flex and
  must work from 360 to 430pt wide. They respect the safe area by padding
  the top 54pt or so in the demo, and they never hard-code a device height.

## 5. Accessibility

- Semantic elements first: `button` for actions, `a` for navigation, plus
  headings in order, lists, `nav`, `section` with labels.
- Every interactive element works by keyboard, with a visible
  `focus-visible` style.
- Icon-only buttons get an `aria-label`. Decorative SVG gets
  `aria-hidden="true"`.
- `prefers-reduced-motion`: use `useReducedMotion()` from motion or the
  `motion-reduce:` variant. With reduced motion there's no autoplay, no
  parallax and no looping animation.
- Live regions for streaming or async updates where it helps
  (`aria-live="polite"`).
- Mobile: `accessibilityRole`, `accessibilityLabel` and
  `accessibilityState` on Pressables.

## 6. Visual QA loop (required)

A dev server runs at `http://localhost:3100`. Every component is visible at
`/preview/<slug>`.

```bash
node scripts/build-registry.mjs
node scripts/shot.mjs <slug> --out=test-results/shots   # 1440, 768, 390 (mobile: 390×844)
```

Open every screenshot and critique it honestly, as a demanding design director
would. Check:

1. Would this look at home on a top-tier studio's site? Does it have an idea?
2. Hierarchy: is it obvious what to read first, second and third?
3. Spacing: is the rhythm consistent, does anything look cramped or float,
   is everything aligned to something?
4. Typography: are the sizes deliberate, are there widows or awkward
   wraps, is the line length sensible?
5. Does it work at 390px, or is it just squashed?
6. Any overflow warning, console error, clipped text or overlapping elements?

Fix and re-shoot until the answer is an unqualified yes. For interactive states
(open menus, toggled pricing, hover cards, success screens), write a small
throwaway Playwright script that clicks, hovers or types, and screenshot that
state too.

## 7. Licence

- `registry/free/**` is MIT.
- `registry/pro/**` is proprietary (see `LICENSE-PRO.md` in the private
  repo). It's never committed to the public repository. The folder is
  gitignored, and CI clones the private repo into it at build time.
