---
title: "JSON prompts for UI design: a structured brief your AI agent can't misread"
slug: json-prompts-for-ui-design
description: What a JSON prompt is, why structured design briefs get more faithful results from AI agents than prose, and a complete schema you can copy for your own components.
excerpt: Prose briefs get paraphrased. Structured briefs get followed. Here's the schema behind every Design for AI component and how to use it.
date: 2026-10-06
dateModified: 2026-10-07
category: Guides
author: Design for AI
keywords: json prompt, json prompting, ui design prompt, structured prompt, ai design brief, prompt for website design, claude json prompt
---

A prose brief is a pleasure to read, and a model will happily paraphrase it. "Tight tracking" becomes `tracking-tight`. "Generous whitespace" becomes `py-16`, the same as everywhere else. The intent survives; the specifics don't.

A **JSON prompt** describes the same design as structured data. Every decision has a key, and every value is concrete. Models treat it less like inspiration and more like a spec, which is exactly what you want when the goal is fidelity.

## What a JSON prompt looks like

Here's the shape every [Design for AI component](/components) uses:

```json
{
  "component": "PricingThreeTier",
  "intent": "Three-plan pricing for a B2B tool, middle plan inverted and featured.",
  "platform": "web",
  "stack": { "framework": "React 19", "styling": "Tailwind CSS v4", "animation": "motion/react" },
  "layout": {
    "container": "max-w-6xl, px 20/32px",
    "grid": "1 col → 3 cols at lg; featured card 24px taller",
    "toggle": "monthly/annual segmented control above the grid, centred"
  },
  "typography": {
    "price": { "font": "display", "weight": 800, "size": "64px", "tracking": "-0.05em", "numerals": "tabular" },
    "planName": { "font": "mono", "size": "11px", "case": "uppercase", "tracking": "0.16em" }
  },
  "color": { "background": "#f5f4f0", "ink": "#1c1a17", "featured": "#1c1a17 on #f5f4f0 inverted", "accent": "#ff5a1f" },
  "motion": { "priceChange": "digits roll vertically, 400ms, ease [0.2,0.8,0.2,1]", "reducedMotion": "instant swap" },
  "responsive": { "mobile": "stacked; featured plan keeps its inverted treatment and moves first" },
  "accessibility": ["toggle is a radiogroup", "prices announced via aria-live when toggled"],
  "content": { "plans": 3, "featuresPerPlan": "5–7, specific, no 'and more'" },
  "avoid": ["three identical cards", "gradient on the featured plan", "'Most popular' sparkle badge"]
}
```

## Why structure beats prose for agents

**Nothing gets lost to paraphrase.** `"tracking": "-0.05em"` has no softer synonym. Prose invites the model to restate it; data asks it to apply it.

**You can change one dimension and keep the rest.** Want the same component in your palette? Replace the `color` object and say "keep everything else". With prose you'd have to rewrite the brief, and you'd risk the model rewriting the design along with it.

**The `avoid` list gets respected.** Models follow explicit prohibitions much more reliably than implied taste. An `avoid` array is the single highest-leverage field in the brief, because it names the exact defaults the model would otherwise reach for.

**Pipelines can use it.** If you generate pages programmatically, compare variants or let an agent assemble a site from parts, structured briefs can be validated, diffed and merged. Prose can't.

## When to use prose instead

The prose prompt is better when you want the model to *interpret*: to rebuild a component in a different stack, carry its feeling into a new layout, or explain the design back to you. It carries the reasoning (why the headline is left-aligned, why only one element animates) that JSON compresses away.

In practice, use both. Paste the prose for intent and the JSON for the specifics. Every Design for AI component page has both, plus a **Copy for agent** button that bundles them with the code.

## A template for adapting a component

```markdown
Rebuild this component for our product using the JSON brief below.
Keep layout, typography, spacing and motion exactly as specified.
Change only:
- color: background #0b1f17, ink #f2f5ef, accent #c8ff5a
- content: we are Fernwood, a field-notes app for ecologists
Respect everything in "avoid".

<prompt.json>
```

Change one or two keys at a time. Asking an agent to "make it on-brand" in one sweep tends to flatten everything distinctive back into the average.

## Frequently asked questions

### What is a JSON prompt?

A JSON prompt is a design or task brief written as structured JSON instead of prose. Each decision (layout, type sizes, colours, motion, things to avoid) gets its own key, so an AI model treats it as a specification rather than loose inspiration.

### Are JSON prompts better than normal prompts?

For fidelity, usually yes: structured briefs are paraphrased less and their constraints are followed more reliably. For open-ended interpretation, prose often works better. Most good workflows use both.

### Which AI tools accept JSON prompts?

Any of them: Claude, ChatGPT, Cursor, Claude Code, v0, Lovable and Bolt all read JSON in a prompt. There's no special syntax; you paste it in and say what to do with it.

### Where can I find JSON prompts for UI components?

Every component on [Design for AI](/components) ships with one, alongside its code and a prose brief. The free components' prompts are MIT licensed.
