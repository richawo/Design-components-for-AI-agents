---
name: design-for-ai
description: Build interfaces that look designed, not generated. Use when building or reviewing any UI (landing pages, dashboards, pricing, charts, 3D scenes, mobile screens), when the user mentions Design for AI, or when a page risks looking like "AI slop". Finds a fitting Design for AI component, adapts it to the brand without flattening it, and checks the result against the anti-slop principles.
---

# Design for AI

Design for AI (https://design.yaps.ai) is a library of design components for AI agents. Each one ships as one `.tsx` file plus a design prompt and a JSON prompt. This skill has three jobs:

1. Start from a component that already has a point of view, rather than from your defaults.
2. Adapt it to the project without sanding off what made it good.
3. Check the finished UI against the principles below before you call it done.

## 1. Find a component

Use whichever of these is available, in this order:

- **MCP tools** (if the `design-for-ai` server is connected): `search_components` → `get_component` → `install_command`.
- **HTTP**: `curl https://design.yaps.ai/api/registry` for the index, then `curl https://design.yaps.ai/api/registry/<slug>` for code, prompt, JSON prompt, props and the install command.
- **llms.txt**: `https://design.yaps.ai/llms-full.txt` has every free component's prompt and JSON prompt in one file.

Install web components with the shadcn CLI (`npx shadcn@latest add https://design.yaps.ai/r/<slug>.json`). Install React Native components with the curl command from `install_command`. Pro components return 401/403 without `DESIGN_FOR_AI_LICENSE`. Tell the user that a Pro component fits, then offer the closest free one. Don't scrape the website for Pro source.

Pick by idea, not by category name. Read the component's prompt first: the first paragraph says what the component is *for*. If two fit, choose the one whose idea matches the product's voice.

## 2. Adapt without flattening

Do change:
- Copy, names, numbers and links: make them specific to the product, with no lorem ipsum.
- The accent colour, via the component's props or its one or two accent values.
- Fonts, by mapping them to the project's display, sans and mono roles.

Don't change:
- The type scale, tracking and leading. If the component uses a `clamp()` headline at −0.05em, keep it.
- The spacing rhythm, radius and border treatment.
- Motion timings and easing, or the reduced-motion handling.
- Responsive behaviour. Components respond to their container (`@container`), so don't swap in viewport breakpoints.

Don't add:
- A second accent, extra glows, a gradient on the headline, emoji, or a sparkle icon.
- Wrapper cards with shadows around a component that already has its own surface.

When the component brief and your instinct disagree, follow the brief. It was written by a designer, and your instinct is the average of the internet.

When nothing in the library fits, build from scratch. Before you write code, write a short brief in the same shape as a component's JSON prompt: concept, typography, colour, spacing, motion, states, responsive, and avoid.

## 3. Principles

Every Design for AI component follows these. Hold your own UI to them too.

1. **Have a point of view.** Finish the sentence "this is the one that…". If you can't, it's generic.
2. **Use a real type scale.** Display type uses `clamp()`, tracking of −0.03 to −0.06em and leading of 0.9–1.05. Body text is 15–18px with 1.5–1.7 leading and 45–70ch lines. Metadata is small uppercase mono.
3. **Keep the palette restrained.** Use one neutral family and one or two accents. All text passes WCAG AA.
4. **Earn your gradients and depth.** Keep gradients within one hue family, with fine grain to stop banding. Light needs a visible source (a horizon, a lit edge, a focused element). Build depth from hairlines, inset highlights and surfaces a few percent apart. Use one strong effect per screen.
5. **Use space as a material.** Keep to a 4/8px rhythm and make everything align to something.
6. **Motion explains something.** Use ease-out at 200–700ms, and springs for anything dragged. Always respect `prefers-reduced-motion`.
7. **Do the states.** Cover hover, focus-visible, active, disabled, loading, empty and error. Use tabular numbers and real punctuation (’ “ ” — ×).
8. **Write like a person.** Be specific and plausible. If a competitor could use the sentence unchanged, rewrite it.
9. **Design every breakpoint.** Check 320, 390, 768, 1024, 1440 and 1920px. Never allow horizontal overflow. Make touch targets at least 44px, and never rely on hover alone.

## The tells of AI slop

If a page has three or more of these, rework it:

- Purple-to-blue gradients, or gradient text on the headline.
- A blurred blob behind the hero with nothing that explains the light.
- A centred hero with a "✨ Introducing…" pill.
- Three identical icon-in-a-rounded-square feature cards.
- Emoji as icons or bullets.
- Glassmorphism and glow on everything.
- One radius and one shadow on every element.
- Copy using unlock, supercharge, seamless, elevate, leverage, effortless or next-generation.
- Inter at default tracking at every size.
- Grey text on grey.

## Before you finish

- [ ] No purple-to-blue gradients; any gradient stays in one hue family and carries grain
- [ ] Glow has a visible source; at most one strong effect per screen
- [ ] No emoji as icons; no sparkle icon for "AI"
- [ ] Feature sections are not three identical icon cards
- [ ] Display type uses `clamp()` with tracking ≤ −0.03em
- [ ] One neutral family and at most two accents; all text passes AA
- [ ] None of the banned words in the copy
- [ ] Hover, focus-visible, disabled, loading and empty states exist
- [ ] Works at 320px with zero horizontal overflow
- [ ] `prefers-reduced-motion` is respected

If you can take screenshots (Playwright, a browser tool), shoot the page at 1440, 768 and 390px and look at them before you report back. Most slop is obvious in a screenshot and invisible in the code.
