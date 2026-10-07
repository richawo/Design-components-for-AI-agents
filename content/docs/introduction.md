---
title: Introduction
description: What Design for AI is, how it's organised, and the fastest way to get a component into your project or in front of your agent.
order: 1
section: Getting started
---

Design for AI is a library of design components for people who build with AI agents. Every component is a single, self-contained file (React + Tailwind CSS v4, or React Native), and every one ships with two more artefacts that most libraries don't have:

- **A prompt**: a design director's brief that describes the component precisely enough for an agent to rebuild it, or adapt it to your brand, from scratch.
- **A JSON prompt**: the same brief as structured data: layout, typography, colour, motion, responsive behaviour, accessibility, content slots and a list of things to avoid.

The point is simple. A model with no direction designs the average of everything it has seen, and the average is what people have learned to recognise as "AI slop". A model with a specific, well-made reference produces specific, well-made work.

## How it's organised

Components are grouped into categories: heroes, pricing, features, social proof, calls to action, navigation, content, AI interfaces, app UI, forms, portfolio, commerce, primitives and mobile. Each component has its own page with:

1. A **live preview**, rendered from the real code, which you can resize to desktop, tablet and mobile widths.
2. The **code**, **prompt** and **JSON prompt** tabs, each with a copy button.
3. A **Copy for agent** button that bundles the install command, the brief and the source into a single message you can paste into any chat.
4. A **props table** and a usage example.

## Free and Pro

Free components are MIT licensed. The code, prompts and JSON prompts are all in the public GitHub repository and on the site, with no account needed.

Pro components are the showpieces: kinetic type, 3D product stacks, drag-and-drop boards, native gestures and the like. Their previews are public, but their code and prompts unlock with a licence. See [pricing](/pricing).

## Three ways in

**1. Install with the shadcn CLI.** Every free component is a registry item:

```bash
npx shadcn@latest add https://design.yaps.ai/r/chart-portfolio.json
```

**2. Let your agent fetch it.** Connect the [MCP server](/docs/agents) and ask: *"Add a Design for AI pricing section that fits this page."* It can search the library, read the prompts and install the code itself.

**3. Paste the brief.** Copy a component's prompt into Claude, Cursor, v0 or Lovable and ask for it in your brand. You get the design thinking without the exact code.

## Requirements

- React 19 and Tailwind CSS v4 for web components. Most also use [`motion`](https://motion.dev), and a few use `lucide-react`.
- React Native 0.76+ for mobile components. They use core APIs only, so they work in Expo and bare projects with no extra dependencies.
- The [Design for AI theme](/docs/installation#the-theme): four font roles (display, serif, sans, mono) that every web component uses.
