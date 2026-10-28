---
title: Installation
description: Install components with the Design for AI CLI or the shadcn CLI, set up the four font roles, add the authenticated Pro registry, and use React Native components.
order: 2
section: Getting started
---

## With the Design for AI CLI

The CLI is packaged directly on this site and works in any React or React Native project:

```bash
npx https://design.yaps.ai/cli.tgz add pricing-plan-toggle
```

It writes `components/design-for-ai/pricing-plan-toggle.tsx` (or under `src/` when you have one) and installs the component's npm dependencies with your package manager. `npx https://design.yaps.ai/cli.tgz search <query>` finds components, and `npx https://design.yaps.ai/cli.tgz prompt <slug>` prints the design brief to hand to your agent. For Pro, run `npx https://design.yaps.ai/cli.tgz login <key>` once.

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

## Crayon style (Pro)

The site header and component pages have an Original / Crayon selector. Your selection follows you across the catalogue. Crayon is visible to everyone and requires a Pro licence to activate, including on free components. Select it to preview the paper palette and hand-drawn typography, then copy its styled source or install command. The named component, props and callbacks stay the same.

For shadcn, add a separate authenticated registry to your `components.json`:

```json
{
  "registries": {
    "@design-for-ai-crayon": {
      "url": "https://design.yaps.ai/r/styles/crayon/{name}.json",
      "headers": { "Authorization": "Bearer ${DESIGN_FOR_AI_LICENSE}" }
    }
  }
}
```

Set `DESIGN_FOR_AI_LICENSE` in your local environment, then install a component:

```bash
npx shadcn@latest add @design-for-ai-crayon/pricing-three-tier
```

Web downloads include scoped styling and a Crayon font declaration. React Native downloads keep native primitives, adapt the paper palette and use handwritten heading font fallbacks. Their component page and MCP install instructions use an authenticated download with the original dependencies. It uses the same file target as the original component; review the replacement if you already customized that file. Connected agents can request `visualStyle: "crayon"` through MCP to retrieve the matching code, design brief and install instructions.

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

Sign in to your [account page](/account) with the email address you bought with to recover your key on any device. Team members use their invited email address to get a personal key. Keep keys out of version control.

## React Native components

Mobile components ship as React Native source files. Their requirements vary: some use core APIs alone; others declare `expo-blur`, `expo-linear-gradient` or `react-native-svg`. Read the selected component's dependency list before adding it. A web preview does not verify your iOS or Android build.

In an existing Expo project, the Design for AI CLI writes the native file and uses `npx expo install` for missing packages:

```bash
npx https://design.yaps.ai/cli.tgz add mobile-tab-bar
```

To inspect the change before installing packages, add `--no-install`. The file is still written; the CLI prints the dependency command separately. Its default destination is `components/design-for-ai/native/mobile-tab-bar.tsx`, or the equivalent under `src/` when that directory exists.

For manual installation, copy the source and install the packages listed on its page. For example, Glass Tab Bar currently requires:

```bash
npx expo install expo-blur expo-linear-gradient react-native-svg
```

An existing bare React Native app must configure Expo modules before using Expo packages. Follow the setup for your React Native version, rebuild the native application and check the selected component on your target devices. In a project without `expo` in `package.json`, the CLI uses the detected package manager and prints an Expo-module setup reminder; it does not configure the native project for you.

You can also download a free native file directly:

```bash
curl --create-dirs -o components/design-for-ai/native/mobile-tab-bar.tsx \
  "https://design.yaps.ai/api/registry/mobile-tab-bar?format=raw"
```

For Pro mobile components, add `-H "Authorization: Bearer $DESIGN_FOR_AI_LICENSE"`. A direct download does not install dependencies. See the [native component guide](/blog/react-native-components-for-ai-agents) for the source, package and device checks.

## By hand

Every component page has a Code tab. Copy the file and follow its listed dependencies, theme requirements and usage example. Check any referenced sibling components when copying a composed block. Connect the callbacks and real services your application needs, then review the result in your own project.
