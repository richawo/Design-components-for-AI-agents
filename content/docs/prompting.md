---
title: Prompts & JSON prompts
description: How Design for AI's prompts are written, when to use the prose prompt versus the JSON prompt, and how to adapt a component to your brand without losing what makes it good.
order: 4
section: For agents
---

Every component has two briefs. They describe the same design, in two shapes.

## The prompt

The prose prompt is written the way a design director briefs a senior engineer: a one-line intent, then layout, typography, colour, motion, accessibility, and a short list of things that would ruin it. It's specific to the point of pedantry, because specificity is the whole trick:

> Headline: display font, weight 800, `clamp(2.9rem, 1.2rem + 7.4vw, 8.25rem)`, line-height 0.92, tracking −0.055em, max 15ch.

"Big bold headline" leaves a model to guess, and it guesses the average. Exact numbers leave nothing to guess.

**Use the prose prompt when** you're working in a chat-style tool (Claude, ChatGPT, v0, Lovable, Bolt) and want the component rebuilt in your stack or style rather than copied.

## The JSON prompt

The JSON prompt holds the same brief as data, with stable keys:

```json
{
  "component": "HeroEditorial",
  "intent": "Oversized editorial landing hero…",
  "platform": "web",
  "stack": {},
  "layout": {},
  "typography": {},
  "color": {},
  "motion": {},
  "responsive": {},
  "accessibility": [],
  "content": {},
  "avoid": []
}
```

**Use the JSON prompt when** you're building a pipeline: generating pages programmatically, comparing designs, swapping one key ("make `color` match this palette") while keeping the rest, or feeding an agent that follows structured specs more faithfully than prose.

The `avoid` array is the most underrated part. It's the list of moves that would turn the component back into slop, and models respect an explicit "don't" far more reliably than an implied one.

## Adapting a component to your brand

The fastest good result is usually:

1. Install the component as-is.
2. Ask your agent to change **colour and copy only**, giving it your palette and voice.
3. Leave typography, spacing and motion alone until you've seen it in place.

Agents asked to "make it fit our brand" in one step tend to sand off everything distinctive. Changing one dimension at a time keeps the design intact.

### A template that works

```markdown
Here is a component's design brief (prompt.json below). Rebuild it for our product.
Keep layout, typography scale, spacing and motion exactly as specified.
Change only:
- color: background #0b1f17, ink #f2f5ef, accent #c8ff5a
- content: our product is Fernwood, a field-notes app for ecologists
Keep everything listed in "avoid".

<paste prompt.json>
```
