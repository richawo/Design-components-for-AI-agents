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
- **Allowed imports (mobile):** `react` and `react-native` core APIs only
  (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Animated`,
  `PanResponder`, `StyleSheet`, `useWindowDimensions`, `Easing`, …). No Expo
  modules, Reanimated, gesture-handler, SVG or icon packages. Previews run
  the real code through react-native-web, so anything that isn't core
  breaks the preview. Draw icons from `View`s, or use plain Unicode
  glyphs, not emoji.
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
- **Keep the palette restrained.** One neutral family (warm paper and ink,
  cool zinc, or true black), plus one or two accents used with intent.
  Contrast meets WCAG AA.
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
- Glassmorphism as a default, or a glow around everything.
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

## 3. Responsive by default

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

## 4. Accessibility

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

## 5. Visual QA loop (required)

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

## 6. Licence

- `registry/free/**` is MIT.
- `registry/pro/**` is proprietary (see `LICENSE-PRO.md` in the private
  repo). It's never committed to the public repository. The folder is
  gitignored, and CI clones the private repo into it at build time.
