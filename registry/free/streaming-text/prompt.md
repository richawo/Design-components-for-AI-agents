Build a streaming AI answer card in React + Tailwind CSS (v4), using `motion/react` for the entrance and `lucide-react` for the control icons. It should read like a well-edited reference answer arriving live: monochrome, calm and legible, with words that settle onto the page like ink and sources treated as first-class.

**Layout**
- The component is one `@container` article; the demo centres it on a black stage at max 820px with 16/32px gutters.
- Card: `#0e0e10`, radius 24px, a 1px `#232327` border, an inset top highlight at white/5% and a deep shadow (`0 32px 80px -32px` black at 90%). Three bands split by 1px rules:
  1. **Header** (28/44px top padding, 24/48px sides from a 576px container): a mono line ("Asked by Noor · 09:14") led by a 20px hairline, then the question.
  2. **Answer**: a 24px status row, a body with min-height 12rem (so the card doesn't jump), then the sources.
  3. **Footer**: a small mono disclaimer on the left, Stop or Regenerate plus Copy on the right. Wraps in narrow containers.
- Sources: an ordered list between `#1b1b1e` hairlines. Each row is a 3-column grid (2rem number, title over publisher, arrow-up-right), at least 48px tall.

**Typography**
- Question: Geist semibold, `clamp(1.75rem, 1.2rem + 2.6cqi, 2.75rem)`, leading 1.05, tracking −0.04em, max 26ch, `text-balance`.
- Answer: Geist at 17.5px (16.5px in narrow containers), leading 1.72, measure 64ch, 1.1em between paragraphs, `text-pretty`. **Bold** goes to full ink at weight 600.
- Labels and disclaimer: mono 11px, uppercase labels at 0.14em tracking. The status line is mono 12px, sentence case, tabular numbers.
- Citations: superscript pills, 17px tall, min 17px wide, mono 10px weight 500, raised −0.45em.

**Colour** (all tokens in one `PALETTE` object, written to `--st-*` CSS variables; `theme="dark" | "light"`)
- Dark: surface `#0e0e10`, line `#232327`, rule `#1b1b1e`, ink `#f4f4f5`, body `#c6c6cc`, muted `#a1a1aa`, faint `#8a8a93`, pill `#202024`. Light: `#ffffff`, `#e4e4e7`, `#efeff1`, `#18181b`, `#3f3f46`, `#52525b`, `#71717a`, `#f0f0f2`.
- One `accent` prop (default `#ff9a6b`), used only for the citation being pointed at and its linked source number: solid fill with ink picked for contrast. Citation pills at rest are the pill grey with muted numbers. The caret, the live dot, the hairline and focus rings are greyscale.

**Motion** (one `MOTION` object; ease-out `[0.22, 1, 0.36, 1]`)
- **Entrance** once 20% in view: the card rises 12px out of an 8px blur over 500ms; then the asked-by line (60ms, its hairline drawing from scaleX 0), the question (120ms), the status row (180ms), the reading list (260ms + 50ms a row) and the footer (400ms).
- **Reading** (350ms lead, then 900ms × pace): a breathing ink dot, "Reading 5 sources", and the five publishers listed in mono (`01 The Crumb Quarterly`). They leave upward with a 4px blur when writing starts. No skeleton bars.
- **Streaming**: tokenise into words (keeping whitespace), each citation and bold run intact. Emit 1–3 tokens per tick (55% one, then 70% two). Wait 14–48ms between ordinary words, 50–120ms after commas, semicolons and dashes, 110–270ms after a sentence, 260–480ms between paragraphs, and 4% of the time a 180–380ms hesitation. `pace` multiplies every delay. One timer at a time, cleared on unmount and on Stop.
- **Ink**: every token settles from opacity 0 and a 4px blur over 420ms, without moving, from one namespaced CSS keyframe (`st-ink`). A 2px × 1.05em ink caret breathes (0.85 → 0.2 opacity, 1.1s) at the live end.
- The status counts live: "Writing · 42 words", then "156 words in 6.2s" or "Stopped after 2.3s · 61 words".
- When it finishes, the "Sources" label and rows rise from a blur, 50ms apart. Hovering or focusing a citation lights its source in the accent, and the reverse.
- **Regenerate** restarts from Reading without the card entrance. **Copy** copies plain text (markers stripped) and pops to a check for 1.6s.
- Reduced motion: the full answer and sources render immediately; entrances are 150ms fades; no ink settle, caret or ping.

**Accessibility**
- The answer region is `aria-live="polite"` with `aria-busy` while reading or streaming, so assistive tech announces the finished answer once rather than every token.
- Citations are links to source anchors (ids from `useId`) with `aria-label="Source n: title"`. The sources are an `ol` under an `h3`.
- Buttons have visible text, are 44px tall in narrow containers (40px above), with a 2px ink focus ring. Copy is disabled while streaming.

**Don't**
- No coloured citation pills at rest, accent carets or accent rules: the accent means "this one".
- No skeleton bars, no constant-speed typewriter, no blinking block cursor.
- No gradient "AI" headers, sparkles or purple. No chat bubble around the answer. Don't hide the sources behind a toggle.
