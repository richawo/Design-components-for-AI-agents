Build a text effect in React 19 + Tailwind CSS v4 + `motion/react` where text and figures spin into their new value on staggered slot reels. Each character is its own reel; when the value changes, only the characters that differ roll through glyphs of their own class and land with one small clunk. It should feel like a well-oiled mechanism behind glass, not a casino.

**Layout**
- The root is any text element (`as`), so the reels inherit the host's font, size, weight, tracking and line height. One `span` per character, inline-block, aligned to the baseline.
- A reel keeps the text's own baseline with a zero-width space in flow; its glyph strip lives in an absolutely positioned window with `overflow: hidden`. At rest the window reaches 0.16em above and below the line box, so accents and descenders are never clipped. While a reel spins the window is exactly the line box, and each row is `1lh` tall with its own overflow hidden, so the slot shows one glyph and a passing glyph is a clean horizontal cut — never a second letter stacked on the first.
- The strip is a column of rows, each exactly `1lh` tall, moved with `translateY` in percent of its own height (row k of n is −k/n × 100%), so it lines up at any font size and line height.
- Width: an invisible copy of the landing character measures the reel; its width eases to the new character over the spin, so proportional type never reflows. A ResizeObserver keeps it honest when fonts load or `cqi` type resizes. Until it has measured, the character renders in flow, so server HTML has the right layout.
- Old and new values are paired character by character. Shorter values are padded on the right for words and on the left for figures (`align="auto"`), so a growing number keeps its units still. Reel keys count from the anchored side.
- Spaces are followed by `<wbr>`, so a long value wraps between words like normal text.

**Typography (demo)**
- Eyebrow: mono 11px uppercase, tracking 0.18em, white/45.
- Name: display, clamp(2.5rem, 0.5rem + 8cqi, 6.5rem), weight 500, leading 0.98, tracking −0.05em, white, sized so the longest name holds one line from 390px up.
- Build line: mono 13–14px uppercase, tracking 0.12em, white/55 with values in white and tabular figures.

**Colour**
- Monochrome. Stage #050506, ink #f4f4f5 / white, muted white at 30–55%, hairline white 9%. The primary button is a light pill (#f4f4f5, hover white) with near-black text. No accent colour: the motion is the point.

**Motion**
- Strip per changed reel: [old character, 4 + 4 × `spins` filler glyphs (plus 0–2 more by position), new character, one glyph past it]. Filler comes from the character's class (digits, capitals, lowercase) with a stable hash, so a word keeps its silhouette mid-spin; punctuation and spaces never spin, they cross-fade (150ms).
- `y` runs over `duration` (900ms) with ease-out `[0.22, 1, 0.36, 1]`, in three keys: the old glyph, a peek 0.12 of a row past the stop (at 86% of the spin), then back onto the new glyph. The peek is a fraction of one row, not of the whole travel, so a long strip still lands with one small clunk. No blur: the cut stays sharp.
- Reels start `stagger` ms apart (45ms), counted only across reels that change. `direction="down"` reverses the strip.
- After the last reel lands, the padding cells and strips are dropped and the DOM is plain characters again. `onSettle` fires then.
- Reduced motion: no strips and no peek; changed characters cross-fade in 150ms.

**Accessibility**
- The visual reels are `aria-hidden`; a visually hidden copy of the full value is always present. `announce` adds a polite live region that speaks the value only after it has landed, never the filler.
- Demo button: a real button, 44px tall, focus-visible ring 2px offset on the stage, press scale 0.97.

**Demo**
- A release-name picker: eyebrow "Release name · picked at random", the name on reels ("Amber Lantern"), a build line ("Build 0427 · Ships THU 15 OCT") on smaller reels with the same timing, a hairline, a "Passed on" list (struck through, newest first, fading by age), and "Spin again". Each spin moves the current name to Passed on and lands the next one: Velvet Static, Copper Meridian, Quiet Harbour. The Customize text field replaces the name with typed text.

**Don't**
- Don't build a split-flap board, add a slot-machine frame, lever or coloured lights, or spin unchanged characters.
- Don't spin letters through digits or symbols, or let reels change width with a jump.
- Don't bounce more than once, smear one glyph into the next, or announce every glyph to screen readers.
