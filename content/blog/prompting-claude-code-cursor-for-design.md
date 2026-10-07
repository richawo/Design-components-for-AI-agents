---
title: How to prompt Claude Code and Cursor for good design
slug: prompting-claude-code-cursor-for-design
description: "A practical workflow for getting well-designed interfaces out of AI coding agents: the brief, references, constraints, the screenshot loop and the review."
excerpt: A five-step workflow, with copyable prompts, that turns an AI coding agent from a template machine into a decent junior designer.
date: 2026-10-05
dateModified: 2026-10-07
category: Guides
author: Design for AI
keywords: claude code design, cursor design prompt, prompt ai for ui, ai frontend design, design prompts, vibe coding design, ai agent ui
---

AI coding agents are very good engineers and very average designers. That isn't a fixed limit. It's what happens when you hand them an engineering-shaped prompt for a design-shaped job. Here's the workflow we use to build every component in this library, with the prompts.

## 1. Brief it like a designer, not a ticket

"Build a pricing page" is a ticket. A design brief says who the page is for, what it should feel like, and what makes it different:

```markdown
Build the pricing section for Ledgerly, accounting software for
two-to-ten-person agencies. Tone: calm, competent, a little dry.
Three plans; the middle one is what 70% of customers pick and should
feel like the obvious choice without shouting. Monthly/annual toggle.
It should feel closer to a well-set financial report than a SaaS template.
```

The last line does more work than everything above it. Give the agent an analogy from outside software and it stops reaching for the software average.

## 2. Hand it a reference

The most reliable way to get a specific result is to show one. Give the agent a component, or better, a component's brief:

```markdown
Use this component as the starting point and keep its typography,
spacing and motion. Adapt colours to our palette and rewrite the copy.

<paste the prompt.json from design.yaps.ai/components/pricing-three-tier>
```

With the [Design for AI MCP server](/docs/agents) connected, you can skip the pasting: *"Find a Design for AI pricing component that suits this brief and adapt it."*

## 3. State the constraints out loud

Agents follow explicit rules far better than implied taste. A short constraint block removes most generic choices before they happen:

```markdown
Constraints:
- No gradient text, glow blobs, glassmorphism or emoji icons.
- Display type: clamp() up to ~6rem, tracking -0.04em, leading 0.95.
- One neutral family + one accent (#ff5a1f). All text passes WCAG AA.
- Never use: unlock, supercharge, seamless, elevate, effortless.
- Must work at 320px with no horizontal overflow; reduced motion respected.
```

Our full [anti-slop checklist](/docs/principles#the-checklist-for-your-agent) is designed to live in your `CLAUDE.md`, `AGENTS.md` or Cursor rules permanently.

## 4. Make it look

This is the step that changes everything. Most agents never see what they build. If yours has a browser or screenshot tool (Claude Code with Playwright, Cursor's browser, any MCP browser), close the loop:

```markdown
After building, screenshot the page at 1440px and 390px wide.
Critique it as a demanding design director: hierarchy, spacing rhythm,
type scale, alignment, anything that looks generic or unfinished.
Fix the problems and repeat until you'd put it in a portfolio.
```

Two or three rounds is typical. The first screenshot almost always reveals something: a cramped mobile header, a widow in the headline, a section that floats.

## 5. Review in passes, not all at once

When you give feedback, give it one dimension at a time: type first, then spacing, then colour, then motion. "Make it better" produces a random walk. "The headline is the same size as the subhead; make it twice as large and tighten the tracking" produces a better headline.

## Put it in your project instructions

Most of this belongs in a file your agent reads every session (`CLAUDE.md` for Claude Code, `.cursor/rules` for Cursor):

```markdown
## Design
- Before any UI work, read the brief and pick a reference component.
- Follow docs/design-principles.md (the anti-slop checklist).
- After UI changes, screenshot at 1440 and 390, critique, fix, repeat.
```

Or install the [Design for AI agent skill](/docs/agents#agent-skill), which packages exactly this behaviour.

## Frequently asked questions

### Why does Claude Code produce generic-looking UI?

With no design direction, it defaults to the most common patterns in its training data, which are generic SaaS templates. Specific references, explicit constraints and a screenshot-and-critique loop fix this.

### What should I put in CLAUDE.md for better design?

A short set of design constraints (banned patterns, type scale, palette rules), a pointer to reference components, and an instruction to screenshot and critique UI changes before finishing.

### Does the screenshot loop really make a difference?

Yes. It's the single biggest improvement. An agent that can see its output notices flat hierarchy, overflow and awkward wrapping that it can't detect from the code alone.

### Can I use Design for AI components in Cursor?

Yes. Install them with the shadcn CLI, connect the MCP server in Cursor's MCP settings, or paste a component's prompt straight into chat.
