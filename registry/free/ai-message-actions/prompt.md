Build the action row that sits under an AI reply in React 19 + Tailwind CSS v4 + `motion/react` (+ `lucide-react` for chevrons and thumbs). It owns the reply's versions, so Copy, Regenerate, a rating and branch navigation all act on the version you are looking at. Quiet at rest, precise in motion: state stays on screen, actions appear when you reach for them.

**Anatomy**
- An `article` (`@container`) with a 20px author mark (a `#f4f4f5` rounded square, 6px radius, the initial in mono 10.5px semibold) and the name (13px 500, tracking −0.01em), then the reply body: 15.5px, leading 1.65, `#c9c9cf`, paragraphs 12px apart, `text-wrap: pretty`.
- 12px below, a `role="toolbar"` row pulled 6px left so the first glyph lines up optically with the text:
  1. **Branches** (only when there are 2+ versions): chevron left, a mono tabular counter `2 / 3` (12.5px, `#a1a1aa`, slash `#8a8a93`, each number in a fixed `ch`-width box), chevron right, then a 1px × 16px hairline divider (`rgba(255,255,255,0.08)`).
  2. **Actions:** Copy, Regenerate, thumbs up, thumbs down.
  3. **Meta slot**, right-aligned mono 12.5px `#8a8a93`: the version's model and time ("Wren 2 · 3.2s"). It doubles as the status line ("Writing version 3…", "Thanks. That helps.", "Couldn't regenerate. Try again."). Hidden below a 26rem container.
- Buttons: `md` 32px square, 8px radius, 16px icons; `sm` 28px, 7px radius, 14px icons. 44px on `pointer: coarse`. Icons 1.4–1.6px strokes.

**The ideas**
- **State stays, actions appear.** At rest only the version counter, any chosen rating and the meta line are visible. The four actions fade in (opacity, 2px rise) when the pointer enters the reply, left to right 28ms apart, and leave together with no delay. They show on keyboard focus anywhere in the reply, always on `hover: none` screens, and always with `alwaysVisible`. The reveal is plain CSS so it answers within a frame.
- **Copy morphs.** The copy glyph is two drawn sheets; on copy both retract (pathLength 1 → 0, 220ms in-out) while a check draws through the same box (0 → 1, 300ms, 80ms later). The tooltip reads "Copied"; after 1.6s it reverses.
- **Regenerate re-inks.** The current text dims to 32% under a 1.5px blur, the circular arrow turns (0.9s per turn, linear) and the meta slot says "Writing version 3…". The new version arrives, the counter rolls to `3 / 3`, and the text inks in word by word (opacity and a 4px blur clearing, 16ms a word, the last word by 900ms).
- **Branches cross-fade with direction.** Next enters from 8px right out of a 3px blur (260ms ease-out) after the old one leaves 6px left (150ms ease-in); Previous mirrors it. The counter's numerals roll vertically in the same direction (70% offset, 2px blur, 240ms). The body's height tweens (340ms ease-out) between versions of different lengths. The branch group grows in from zero width (spring 500/40) the first time a second version exists.
- **Thumbs ask, never demand.** Thumbs up fills in the accent with a stroke mixed 62% accent / 38% ink (so it holds 3:1 on either surface) and pops once (scale 1 → 1.22 → 1, a −10° tilt, 340ms). Thumbs down fills too and opens a popover above the row (≤340px, 14px radius, `#141416`, `#27272a` border, deep soft shadow): "What missed the mark?", a muted line saying it is optional, toggle chips (Not accurate, Missed the brief, Too long, Wrong tone; picked = accent 14% fill and 55% border), a two-row note field, Skip and an accent "Send feedback". It enters from 6px below, scale 0.98, a 4px blur (220ms) and exits in 140ms. Ratings are kept per version.

**Colour (monochrome first; one accent)**
- Dark: ink `#f4f4f5`, body `#c9c9cf`, muted `#a1a1aa`, faint `#8a8a93`, hover `rgba(255,255,255,0.07)`, press 11%. Light: ink `#18181b`, body `#3f3f46`, muted `#52525b`, faint `#6b6b73`, hover `rgba(24,24,27,0.06)`.
- Accent `#ff9a6b` (one prop) only on a chosen rating, picked chips and the Send button. Tooltips invert (ink background, 6px radius, 11.5px 500), open after 420ms and instantly when moving to a neighbour within 320ms.

**Motion**
- Ease-out `[0.22, 1, 0.36, 1]`, ease-in `[0.4, 0, 1, 1]` for exits, in-out `[0.65, 0, 0.35, 1]` for the copy morph. Press is scale 0.94 with a stronger fill. First view: the author line and paragraphs rise 8px out of a 6px blur (500ms, 60ms apart), the row fades in at 280ms; switching versions never replays it.
- Reduced motion: every transform, blur, roll, spin and pop goes; opacity fades of 150ms or less stay; a regenerated reply appears whole.

**Accessibility**
- Icon buttons carry `aria-label`s (Previous version, Copy reply, Regenerate, Good response, Bad response); thumbs use `aria-pressed`; thumbs down has `aria-haspopup="dialog"` and `aria-expanded`; Regenerate is `aria-busy` while writing. The article is labelled "Wren's reply, version 2 of 3".
- Arrow keys, Home and End move along the toolbar. The popover focuses its first chip, keeps Tab inside, closes on Escape, Skip, Send or an outside click, and returns focus to thumbs down.
- A polite live region says "Copied to clipboard", "Writing version 3", "Version 3 of 3 ready", "Feedback sent". Focus outlines are 2px, offset 2px, keyboard only.

**Demo stage**
- Black page, a 640px `#0b0b0c` panel (20px radius, hairline ring), a right-aligned user bubble ("Write the release note for Tern 4.2. Under 80 words, no hype.", `#1c1c1f`, 18px radius with a 6px tail corner, "You · 09:41" in mono under it), then the reply with two takes; Regenerate deals further takes after a 650ms pause.

**Don't**
- No sparkle icon, no gradient, no glow, no coloured icon per action, no labels under the icons, no toast for "Copied". Don't hide the version counter or a chosen rating on mouse-out. Don't swap the copy icon with a cut, don't let the row change height between states, and never make the reason popover required to rate.
