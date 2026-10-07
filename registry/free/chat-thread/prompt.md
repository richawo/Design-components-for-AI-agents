Build an AI chat thread in React + Tailwind CSS (v4), using `motion/react` for the streaming caret and message entrances and `lucide-react` for icons. It should feel like a calm writing tool with a character, not a messenger app: the assistant writes documents, the person sends notes.

**Layout**
- Outer section on a warm stone `#e9e3d8` with 24px side padding and 32–40px vertical padding from `sm` up. Inside sits one window: max-width 1040px, 820px tall (100dvh capped at 880px, min 620px on phones), paper `#f7f4ee`, radius 22px, a 1px ring at 8% ink and a long soft shadow (`0 30px 60px -30px` at 35% ink). Below `sm` the window goes full-bleed: no radius, no ring, no padding.
- Header, 64px tall, 1px bottom rule at 8% ink: thread title (display font, 16–17px, weight 600, −0.02em) over a mono metadata line (10.5px, uppercase, 0.12em tracking, 50% ink), and a 44px round "New thread" icon button on the right.
- The message column is 720px max, centred, 16px gutters on phones and 32px from `sm`, with 36px between messages. It scrolls inside the window and follows the conversation while the reader is at the bottom (a ResizeObserver plus a "pinned" flag that turns off when they scroll up more than 48px).
- **User messages** are compact ink bubbles, right-aligned: `#1d1a16` fill, paper text, 15px / 1.55, max-width min(82%, 30rem), radius 18px with the bottom-right corner at 6px, a mono time stamp under it.
- **Assistant replies have no bubble.** A byline (28px ink avatar with the name's first letter in italic serif and a small clay status dot, the name in 14px semibold, a mono time) sits over content indented 38px from `sm` so the text aligns with the name. Body 16px / 1.7 at 86% ink, measure 64ch, 16px between blocks.
- Lists use a 10×2px clay dash as the marker. Inline `code` sits on a 6% ink tint with 5px radius; **bold** goes full ink.
- Code block: ink `#1d1a16`, radius 14px. A 44px caption bar shows an uppercase language tag on an 8% white chip, the filename at 55% white, and a Copy button on the right that swaps to a green check and "Copied" for 1.6s. Code in 13px mono at 1.75 leading, scrolling horizontally inside the block. Keep a small regex highlighter: comments `#8f8778` italic, strings `#b9d2a5`, numbers `#f2c38b`, keywords `#f0a37f`, Capitalised names `#f2d9a6`.
- Sources sit under the reply after it finishes: a "Sources" mono label, then wrapping 44px-tall cards (number in a 24px tinted square, title 13px medium, domain in mono). Then a quiet Copy action for the whole reply.
- Composer pinned at the bottom with a 32px paper fade above it: `#fffdf9`, radius 20px, 1px border at 12% ink, a soft shadow that deepens on focus-within. Attachment chips (if any) sit above the auto-growing textarea (16px, grows to 208px, then scrolls). The toolbar holds the attach button and the model label (a clay dot and mono 11px) on the left, a "↵ send · ⇧↵ new line" hint from `md` up, and a round ink send button on the right. A one-line mono disclaimer sits under the composer from `sm` up.

**Typography**
- Display (Bricolage Grotesque) is only for the thread title. The sans (Geist) carries the conversation. Mono (Geist Mono) carries every piece of metadata: times, tags, the model, hints and the code.

**Colour**
- Stone `#e9e3d8` around the window, paper `#f7f4ee` for it, cream `#fffdf9` for raised surfaces (composer, source cards), ink `#1d1a16` for text and user bubbles, and clay `#b4532a` as the only accent (caret, list dashes, status dot, send-button hover, focus rings). Grey text is always ink at an opacity of 40% or more, never a separate grey.

**Motion**
- The last assistant message streams on mount: 420ms of three pulsing "thinking" dots, then characters arrive in uneven chunks (usually 2–6, sometimes a 10–22 burst) every 18–52ms, with an occasional 160–340ms pause. A clay block caret (0.5em × 1.05em, radius 2px) breathes between 100% and 25% opacity at the end of whatever is streaming, inside paragraphs, list items or code. "writing…" shows in the byline until it's done.
- Sources fade up 6px over 450ms with ease [0.2, 0.8, 0.2, 1] once the stream ends.
- New user bubbles rise 8px over 350ms. Attachment chips expand in height.
- Sending appends the user message and a canned reply (`reply(text)`) that streams the same way. While it streams, the send button becomes a Stop button. Stopping freezes the text where it is and marks the byline "stopped".
- Reduced motion: no streaming, no caret, no entrances. Everything renders complete.

**Behaviour and accessibility**
- Enter sends, Shift+Enter adds a newline, and IME composition is respected (`isComposing`). Send is disabled, at 15% ink, when the draft is empty or a reply is streaming.
- The message list is `role="log"`. Each message is an `article` labelled "You said" or "Wren said", with `aria-busy` while it streams.
- The textarea has a visually hidden label. Every icon button has an `aria-label`. Focus rings are 2px clay with a paper offset. Touch targets are 44px on phones (36px from `sm`).
- The attach button opens a hidden file input; chosen file names become removable chips.

**Don't**
- No bubble around assistant replies, no gradient avatars, no sparkle icon for the assistant, no purple.
- No grey-on-grey: keep secondary text as ink at an opacity.
- Don't stream character by character at a constant rate. It reads as a typewriter, not a model.
- Don't let the page scroll horizontally: code scrolls inside its own block.
