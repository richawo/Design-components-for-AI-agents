---
title: Contributing
description: How to propose and build a free component that meets the Design for AI bar, from the four-file contract to the visual QA loop.
order: 7
section: About
---

Design for AI's free library is open source and contributions are welcome. The bar is high on purpose, because the library's value is that *every* component is good.

## The contract

Each component is a folder in `registry/free/` with four files:

```
registry/free/your-component/
  your-component.tsx   one self-contained file
  meta.json            name, category, description, tags, props…
  prompt.md            the design brief, in prose
  prompt.json          the same brief, as data
```

The full spec, including allowed imports, theming, accessibility and the "never" list, is in [`docs/COMPONENT_SPEC.md`](https://github.com/richawo/Design-components-for-AI-agents/blob/main/docs/COMPONENT_SPEC.md).

## The loop

```bash
npm install
npm run dev                     # http://localhost:3000
node scripts/build-registry.mjs # validates every component
node scripts/shot.mjs your-component --base=http://localhost:3000
```

The screenshot script captures your preview at 1440, 768 and 390px and warns about horizontal overflow and console errors. Look at every screenshot as a demanding design director would, then fix and re-shoot.

## Demo and controls

Most components also ship a short scripted demo and a few tunable props, both in `meta.json`. The demo plays on the component page with a drawn cursor (and stops the moment a visitor moves) and becomes the gallery card's hover video; the controls appear under the preview, in the URL and in the copied snippet. Name the elements the demo touches with `data-demo="…"`, make the default export accept `Partial<Props>` overrides, then run one command that validates, screenshots, checks every control and records the video:

```bash
node scripts/check-component.mjs your-component --base=http://localhost:3000
```

The format and rules are in the spec's "Demo script" and "Controls" sections.

## What gets merged

- It has an idea, and it's not a reskin of something already in the library.
- It works at 320px and at 1920px, by keyboard, and with reduced motion.
- Its prompts are specific enough that a model can rebuild it without seeing the code.
- It passes `npm run typecheck`, `npm test` and `node scripts/check-component.mjs <slug>`.

Open an issue first if you're planning something big. We're happy to help shape it.
