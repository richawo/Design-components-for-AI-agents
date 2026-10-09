Build an AI chat thread in React + Tailwind CSS (v4), using `motion/react` for the choreography and `lucide-react` for icons. It should feel like a calm writing tool with a character, not a messenger app: the assistant writes documents, the person sends notes, everything is greyscale, and a reply arrives like ink settling on paper.

**Layout**
- The component is one `@container` root that fills its parent's height (the demo gives it 820px on a black stage, 100dvh on phones, max 1040px wide). Inside sits the window, `#0e0e10`. From a 576px container it gets radius 22px, a 1px `#232327` border, an inset top highlight and a deep shadow (`0 32px 80px -32px` black at 90%); narrower, it goes full-bleed.
- Header, 64px, a rule under it: thread title (display, 16–17px, weight 600, −0.02em) over a mono line (10.5px, uppercase, 0.12em), and a 44px "New thread" icon button. Without `onNewThread`, it clears the thread to an empty state: mono "NEW THREAD", "What are we working on?" and one muted line, staggering in.
- The message column is 720px max, centred, 16px gutters (32px from 576px), 36px between messages. It scrolls inside the window and follows the conversation while the reader is at the bottom (a ResizeObserver plus a "pinned" flag that lets go when they scroll up more than 48px).
- **User messages**: right-aligned `#1c1c1f` bubbles with an inset highlight, 15px / 1.55, max-width min(82%, 30rem), radius 18px with the bottom-right corner at 6px, a mono time under them.
- **Assistant replies have no bubble.** A byline (a 28px ink disc with the name's initial, the name in 14px semibold, a mono time, "writing…" while live) over content indented 38px from 576px. Body 16px / 1.7 in `#cfcfd4`, measure 64ch, 16px between blocks. Lists use a 10×2px grey dash; inline `code` sits on a 6% ink tint; **bold** goes to full ink.
- Code block: `#08080a`, 1px line border, radius 14px. A 44px caption with an uppercase language tag, the filename in faint grey, and Copy (swaps to a check and "Copied" for 1.6s). 13px mono at 1.75, scrolling horizontally inside the block.
- Sources follow a finished reply: a mono label, then wrapping 44px cards (number tile, 13px title, mono domain). Then a quiet Copy for the whole reply.
- Composer pinned at the bottom with a 32px fade from the window colour: `#141416`, radius 20px, 1px line border (ink at 30% on focus-within). Attachment chips above an auto-growing textarea (16px, up to 208px). Toolbar: attach, the model in mono 11px, a "↵ send · ⇧↵ new line" hint from 768px, and the round send button. A mono disclaimer under it from 576px.

**Colour** (one `PALETTE` object written to `--ct-*` CSS variables; `theme="dark" | "light"`)
- Dark: window `#0e0e10`, raised `#141416`, bubble `#1c1c1f`, code `#08080a`, line `#232327`, rule `#1b1b1e`, ink `#f4f4f5`, body `#cfcfd4`, muted `#a1a1aa`, faint `#8a8a93`. Light: `#ffffff`, `#fafafa`, `#f1f1f3`, `#f7f7f8`, `#e4e4e7`, `#efeff1`, `#18181b`, `#3f3f46`, `#52525b`, `#71717a`.
- Syntax in luminance only. Dark: base `#bdbdc4`, keywords `#f4f4f5` weight 500, Capitalised types `#e4e4e7`, numbers `#d4d4d8`, strings `#9d9da6`, comments `#75757e` italic. Light: `#52525b`, `#18181b`, `#27272a`, `#3f3f46`, `#71717a`, `#8a8a93`.
- One `accent` prop (default `#ff9a6b`) in exactly two places: the send button's fill when there's something to send (arrow ink picked for contrast), and a small dot on the assistant's avatar while it writes. Carets, dashes, focus rings and checks stay greyscale.

**Motion** (one `MOTION` object; ease-out `[0.22, 1, 0.36, 1]`; `spring.ui` 500/40)
- **Entrance**, once 20% in view: the window rises 16px out of an 8px blur over 500ms; the title, subtitle and New-thread button follow 50ms apart; each message rises 12px out of a blur in reading order, 60ms apart from 160ms; then the composer, its four controls 40ms apart, and the disclaimer.
- The last reply waits until its block has landed, shows three pulsing grey dots for 420ms, then streams: chunks of 2–6 characters (12% of the time a 10–22 burst) every 18–52ms, with an occasional 160–340ms pause. One timer at a time, cleared on unmount and Stop.
- **Ink**: every chunk is its own span keyed by its character offset, so it mounts once and settles from opacity 0 and a 3px blur over 380ms (one namespaced CSS keyframe, `ct-ink`), in paragraphs, list items, inline code and highlighted code alike. A 2px ink caret breathes at the live end.
- When a reply finishes, the sources label and cards rise out of a blur 50ms apart, then Copy.
- Sending: the bubble springs up out of the composer (16px, scale 0.96 from its bottom-right corner, a 6px blur, spring 420/34); the reply's byline enters and streams the same way. Send and Stop swap with a pop on `spring.ui` and press to 0.92; the send arrow sits 2px low until the draft has text.
- Reduced motion: everything renders complete; entrances are 150ms fades; no ink, caret or dots.

**Behaviour and accessibility**
- Enter sends, Shift+Enter adds a line, IME composition is respected. Send is disabled when the draft is empty or a reply is streaming. Stop freezes the text and marks the byline "stopped".
- The message list is `role="log"`. Each message is an `article` labelled "You said" or "Wren said", with `aria-busy` while it streams.
- The textarea has a visually hidden label (`useId`); every icon button has an `aria-label`. Focus rings: 2px ink, offset 2px, keyboard only. Touch targets 44px in narrow containers.
- The attach button opens a hidden file input; chosen names become removable chips.

**Don't**
- No bubble around assistant replies, no gradient avatars, no sparkle icon, no purple.
- No colourful syntax theme and no accent-coloured carets, bullets or rings.
- Don't stream at a constant rate, and don't let the thread simply appear.
- Don't let the page scroll horizontally: code scrolls inside its own block.
