---
title: Installation
description: Install components with the Design for AI CLI or the shadcn CLI, set up the four font roles, add the authenticated Pro registry, and use React Native components.
order: 2
section: Getting started
---

## With the Design for AI CLI

No setup, works in any React or React Native project:

```bash
npx design-for-ai add pricing-plan-toggle
```

It writes `components/design-for-ai/pricing-plan-toggle.tsx` (or under `src/` when you have one) and installs the component's npm dependencies with your package manager. `npx design-for-ai search <query>` finds components, and `npx design-for-ai prompt <slug>` prints the design brief to hand to your agent. For Pro, run `npx design-for-ai login <key>` once.

## With the shadcn CLI

If your project already uses [shadcn/ui](https://ui.shadcn.com), you're one command away. Every free component is published as a registry item:

```bash
npx shadcn@latest add https://design.yaps.ai/r/pricing-three-tier.json
```

The file lands in `components/design-for-ai/`, its npm dependencies are installed, and the theme is added the first time.

If you don't use shadcn yet, `npx shadcn@latest init` sets up the `components.json` it needs. That takes about a minute.

## The theme

Every web component uses four Tailwind font roles, which keeps them consistent with each other and makes them easy to rebrand:

| Role | Default | Used for |
| --- | --- | --- |
| `font-display` | Geist (tight tracking) | Headlines, big numbers |
| `font-serif` | Instrument Serif | Italic accents, quotes |
| `font-sans` | Geist | Body copy, UI |
| `font-mono` | Geist Mono | Metadata, code, labels |

The registry's `theme` item adds them to your CSS. To do it by hand in Tailwind v4:

```css
@import "tailwindcss";
@import "@fontsource/instrument-serif/400.css";
@import "@fontsource/instrument-serif/400-italic.css";
@import "@fontsource-variable/geist";
@import "@fontsource-variable/geist-mono";

@theme {
  --font-display: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Instrument Serif", ui-serif, Georgia, serif;
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, monospace;
}
```

Swap the families for your brand's and every component follows. That's the whole theming system, on purpose: colours belong to each component's design, and the prompts tell your agent how to change them.

## Pro components

Pro components are served from an authenticated registry namespace. Add it to `components.json` once:

```json
{
  "registries": {
    "@design-for-ai-pro": {
      "url": "https://design.yaps.ai/r/pro/{name}.json",
      "headers": { "Authorization": "Bearer ${DESIGN_FOR_AI_LICENSE}" }
    }
  }
}
```

Put your licence key in your environment (`.env.local` works):

```bash
DESIGN_FOR_AI_LICENSE=dfa_…
```

Then install any Pro component by name:

```bash
npx shadcn@latest add @design-for-ai-pro/hero-kinetic-type
```

Your key is on your [account page](/account). Keep it out of version control.

## React Native components

Mobile components are one file each and use only React Native core APIs: no Expo modules, no Reanimated, no SVG library. Copy the file into your app:

```bash
curl --create-dirs -o components/design-for-ai/native/mobile-tab-bar.tsx \
  "https://design.yaps.ai/api/registry/mobile-tab-bar?format=raw"
```

For Pro mobile components, add `-H "Authorization: Bearer $DESIGN_FOR_AI_LICENSE"`.

## By hand

Every component page has a Code tab. Copy the file, install the dependencies listed at the top of the page (usually just `motion`), and you're done. There are no shared utilities, providers or wrappers to set up.
