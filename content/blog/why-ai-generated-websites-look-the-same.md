---
title: Why AI-generated websites all look the same (and how to fix it)
slug: why-ai-generated-websites-look-the-same
description: Purple gradients, sparkle badges, three identical cards. Why AI coding agents converge on the same design, and the changes that make their output look designed.
excerpt: The "AI slop" look isn't a bug in any one model. It's what averaging produces. Here's the mechanism, the tells, and how to break the pattern.
date: 2026-10-07
dateModified: 2026-10-07
category: Essays
author: Design for AI
keywords: ai slop, ai generated website, generic ui, ai website design, claude code design, cursor ui, v0 design, ai agent frontend
---

Ask any AI coding agent for "a landing page for my SaaS" and you'll get the same page. A dark background with a purple-to-blue glow. A pill badge reading "✨ Introducing…". A centred headline in gradient text promising to *supercharge* something. Then three cards, each with an icon in a rounded square, a two-word title and a line of grey text.

People recognise it instantly now. It even has a name: AI slop. And as more of the web gets built by agents, looking like slop has started to cost something real. Visitors read the page as low-effort, and low-effort reads as low-trust.

This piece explains why it happens, what the tells are, and what actually fixes it.

## Why every agent designs the same page

A language model writing a landing page is predicting the most likely next token, given everything it has seen. For code and prose, "most likely" is often a fine definition of "correct". For design, it's a precise definition of *average*.

Taste is a set of specific, opinionated choices: this typeface and not that one, this much space, this one accent colour, used here and nowhere else. A model asked to design with no constraints doesn't make those choices. It takes the central tendency of thousands of SaaS templates, which happen to be the most common UI in its training data. The purple gradient isn't anyone's preference. It's the mean.

Three things make it worse:

1. **Short prompts.** "Make it modern and clean" gives the model nothing to deviate *towards*, so it doesn't.
2. **Component libraries as defaults.** Agents lean heavily on the most popular primitives, with the same radius, shadow and grey scale. Great building blocks, but identical ones.
3. **No visual feedback.** Most agents never *look* at what they built. They can't notice that the hierarchy is flat or that the page looks like every other.

## The tells

If a page has three or more of these, people assume a machine made it:

- Gradient text on the headline, usually purple into blue.
- A blurred glow blob behind the hero.
- A centred hero topped by a pill badge with a sparkle.
- Feature sections as three identical icon cards.
- Emoji as icons or bullet points.
- Glassmorphism everywhere, and the same `rounded-2xl` plus `shadow-lg` on every surface.
- Words like *unlock*, *seamless*, *elevate*, *effortless* and *next-generation*.
- One typeface at default tracking for everything from 12px labels to 72px headlines.

None of these is wrong on its own. The problem is the combination, and the fact that each one stands in for a decision nobody made.

## What actually fixes it

### Give the model a reference, not an adjective

"Make it look premium" changes nothing. A reference does: an existing component with exact numbers attached. *Display font, weight 800, `clamp(2.9rem, 1.2rem + 7.4vw, 8.25rem)`, tracking −0.055em, line-height 0.92.* There's no average to fall back to when the spec is that specific.

This is the idea behind [Design for AI](/components): every component ships with its code, a prose brief and a [JSON prompt](/blog/json-prompts-for-ui-design), so your agent starts from something designed, not from the mean.

### Tell it what not to do

Models follow explicit prohibitions far more reliably than implied taste. A short "never" list (no gradient text, no emoji icons, no centred hero with a badge, none of these ten words) removes most of the slop on its own. Our [anti-slop principles](/docs/principles) end with a checklist you can paste straight into your agent's instructions.

### Make it look at its own work

Agents that can take a screenshot and critique it produce dramatically better UI. In Claude Code, Cursor or any agent with a browser tool, add one instruction: *"After building, screenshot the page at 1440px and 390px, list every problem a senior designer would notice, fix them, and repeat."* Every Design for AI component went through exactly that loop.

### Change one thing at a time

When you adapt a good component to your brand, change colour and copy first, and leave type, spacing and motion alone until you've seen it in place. Asking for everything at once invites the model to "normalise" the design straight back to average.

### Write real copy

Slop copy is the easiest tell to fix and the most often ignored. Name real numbers, real people (or plausible fictional ones) and real outcomes. If a sentence could appear unchanged on a competitor's site, rewrite it.

## Frequently asked questions

### What does "AI slop" mean in web design?

It's the generic, instantly recognisable look of interfaces generated by AI with no design direction: purple gradients, sparkle badges, identical icon cards, vague copy. It comes from models defaulting to the statistical average of the UI they were trained on.

### Can AI agents design good-looking websites?

Yes, if you give them specific direction. Precise references, explicit "don't" lists and a screenshot-and-critique loop turn the same model from producing slop into producing work that looks deliberately designed.

### What's the fastest way to make an AI-built site look less generic?

Replace the hero and the feature section with well-designed components, ban gradient text and emoji icons, and rewrite the headline with specific claims. Those three changes remove most of what makes a page read as machine-made.

### Does this apply to Claude Code, Cursor, v0 and Lovable?

It does. They all share the same underlying problem, and the fix works the same way in each: a specific reference, explicit constraints and visual feedback.
