Build a streaming AI answer card in React + Tailwind CSS (v4), using `motion/react` for the caret, citations and source reveal and `lucide-react` for the control icons. It should read like a well-edited reference answer arriving live, calm and legible, with the sources treated as first-class rather than an afterthought.

**Layout**
- Section on pure black, 16px gutters (32px from `sm`), 48px vertical padding (80px from `sm`).
- One card, max-width 820px, centred: `#0b0b0c`, radius 24px, a 1px ring at white/8%, an inset top highlight at white/6% and a deep shadow (`0 30px 80px -30px` black at 90%). It has three bands split by 1px rules at white/8%:
  1. **Header** (28/44px top padding, 24/48px sides): a mono line ("Asked by Noor · 09:14") led by a 20px accent hairline, then the question as the headline.
  2. **Answer**: a 24px-tall status row, the answer body (min-height 12rem so the card doesn't jump), then the sources list.
  3. **Footer**: a small mono disclaimer on the left, Stop or Regenerate plus Copy on the right. Wraps on phones.
- Sources: an ordered list between hairlines. Each row is a 3-column grid (2rem number, title over publisher, arrow-up-right icon), at least 48px tall.

**Typography**
- Question: Geist semibold, `clamp(1.75rem, 1.2rem + 2.2vw, 2.75rem)`, leading 1.05, tracking −0.04em, max 26ch, `text-balance`.
- Answer: sans (Geist) at 17.5px (16.5px on phones), leading 1.72, white at 76%, measure 64ch, 1.1em between paragraphs, `text-pretty`. **Bold** goes full white at weight 600.
- Labels and disclaimer: mono, 11px, uppercase, tracking 0.14em, white/50–55. The status line is mono 12px in sentence case at white/60 with tabular numbers ("155 words in 5.9s").
- Citations: superscript pills, 17px tall, min 17px wide, mono 10px weight 500, raised −0.45em.

**Colour**
- Background black, card `#0b0b0c`, white type (answer at 76%, metadata at 50–55%), and warm peach `#ff9a6b` as the only accent: caret, citation pills (12% tint with peach text; solid with black text when active), status dot, source numbers and focus rings (offset against the card colour).

**Motion**
- **Reading** (900ms): a pinging accent dot, "Reading 5 sources" and three pulsing dots, with three skeleton lines (92%, 100%, 76% wide) breathing in the body.
- **Streaming**: tokenise into words (keeping whitespace), with each citation and each bold run kept intact. Emit 1–3 tokens per tick (55% one, then 70% two). Wait 14–48ms between ordinary words, 50–120ms after commas, semicolons and dashes, 110–270ms after a sentence, 260–480ms between paragraphs, and 4% of the time add a 180–380ms hesitation. Average out around 5 seconds for 155 words. A `pace` prop multiplies every delay.
- Soft caret: a 3px × 1.1em rounded accent bar at the live end of the last paragraph, breathing between 90% and 20% opacity over 1s.
- Each citation pill pops in from scale 0.6 and opacity 0 over 300ms.
- When it finishes, the sources block fades up 8px over 550ms, and rows slide in 6px from the left, 60ms apart, with ease [0.2, 0.8, 0.2, 1]. The status becomes "155 words in 5.9s".
- Hovering or focusing a citation highlights its source row, and the reverse.
- **Stop** freezes the text and shows "Stopped after 2.3s". **Regenerate** restarts from Reading. **Copy** copies plain text (bold markers stripped) and shows a check and "Copied" for 1.6s.
- Reduced motion: render the full answer and sources immediately, with no caret, skeleton or ping.

**Accessibility**
- The answer region is `aria-live="polite"` with `aria-busy` while reading or streaming, so assistive tech announces the finished answer once rather than every token.
- Citations are links to `#streaming-text-src-n` with `aria-label="Source n: title"`. The sources are an `ol` under an `h3`.
- Buttons have visible text, are 44px tall on phones (40px from `sm`) and show a 2px accent focus ring. Copy is disabled while streaming.

**Don't**
- No blinking block cursor at a constant rate, and no constant-speed typewriter.
- No gradient "AI" headers, sparkles or purple. No chat bubble around the answer.
- Don't hide the sources behind a toggle, and don't render citations as bracketed text.

**Feel**
- Control buttons press to 0.96. Regenerate's arrow winds back half a turn on hover (500ms, ease-out). Copy's icon pops to a check on a stiff spring.
- Source rows press to 0.99.
