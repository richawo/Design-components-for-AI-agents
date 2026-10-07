---
title: Anti-slop principles
description: The design rules every Design for AI component follows, and a checklist you can give any AI agent so its interfaces stop looking generated.
order: 5
section: Design
---

"AI slop" isn't one mistake. It's the stack of defaults a model reaches for when nobody tells it otherwise. Each default is reasonable on its own; together they produce the interface everyone now recognises at a glance.

These are the rules every Design for AI component is built and reviewed against. They also work as a system prompt: paste them into your agent's instructions and you'll see the difference on the next page it builds.

## The tells

If an interface has three or more of these, people will assume a machine made it:

- Purple-to-blue gradients, especially as gradient text on the headline.
- A soft blurred "blob" glowing behind the hero.
- A centred hero with a pill badge saying "✨ Introducing…".
- Three identical feature cards, each an icon in a rounded square, a title and two grey lines.
- Emoji used as icons or bullet points.
- Glassmorphism and glows on everything.
- One border radius and one shadow, applied to every element.
- Copy that says nothing: "Unlock", "Supercharge", "Seamless", "Elevate", "Next-generation".
- Inter at default tracking, at every size.
- Grey text on a grey background.

## The rules

### 1. Have a point of view

Every component has an idea: a pricing table that's a printed receipt, a hero whose type responds to your cursor, an agent log that reads like a flight recorder. Before you build, finish the sentence "this is the one that…". If you can't, it's generic.

### 2. Use a real type scale

Make big type big: display headlines up to 6–9rem with `clamp()`, tracking −0.03 to −0.06em, and leading between 0.9 and 1.05. Body runs at 15–18px with 1.5–1.7 leading and lines 45–70 characters long. Use small uppercase mono for metadata. Contrast in size is what creates hierarchy; three sizes that are nearly the same create mush.

### 3. Keep the palette restrained

Pick one neutral family (warm paper and ink, cool zinc, or true black) and one or two accents, used on purpose. Every text colour passes WCAG AA.

### 4. Use space as a material

Generous, deliberate whitespace on a 4/8px rhythm. Everything aligns to something. Asymmetry is allowed, but it has to look intended.

### 5. Motion should explain something

Animate to show a change of state, direct attention, or reward an interaction. Use ease-out curves at 200–700ms, and springs for anything that gets dragged. Respect `prefers-reduced-motion` every time.

### 6. Do the states

Hover, focus-visible, active, disabled, loading, empty and error. Use tabular numbers for figures, real punctuation (’ “ ” — ×), and optically aligned icons. The details nobody notices are the ones people feel.

### 7. Write like a person

Make the copy specific and human, with fictional but plausible names, numbers and dates. A good test: could this sentence appear on a competitor's site unchanged? If so, rewrite it.

### 8. Design every breakpoint

Check 320, 390, 768, 1024, 1440 and 1920px. "Doesn't break" isn't the bar; *designed* is. Never allow horizontal overflow. Touch targets are at least 44px, and nothing depends on hover alone.

## The checklist for your agent

Copy this into your agent's instructions:

```markdown
Before finishing any UI work, check:
- [ ] No gradient text, no glow blobs, no glassmorphism by default
- [ ] No emoji as icons; no sparkle icon for "AI"
- [ ] Not a centred hero with a pill badge
- [ ] Feature sections are not three identical icon cards
- [ ] Display type uses clamp() with tight tracking (≤ -0.03em)
- [ ] One neutral family + at most two accents; all text passes AA
- [ ] Copy contains no: unlock, supercharge, seamless, elevate, leverage, effortless
- [ ] Hover, focus-visible, disabled, loading and empty states exist
- [ ] Works at 320px with zero horizontal overflow
- [ ] prefers-reduced-motion is respected
```
