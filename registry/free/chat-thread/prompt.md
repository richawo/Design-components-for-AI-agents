Build an AI chat thread in React + Tailwind CSS (v4), using `motion/react` for the streaming caret and message entrances and `lucide-react` for icons. It should feel like a calm writing tool with a character, not a messenger app: the assistant writes documents, the person sends notes.

**Layout**
- Outer section on pure black with 24px side padding and 32–40px vertical padding from `sm` up. Inside sits one window: max-width 1040px, 820px tall (100dvh capped at 880px, min 620px on phones), `#0b0b0c`, radius 22px, a 1px ring at white/8%, an inset top highlight and a deep black shadow (`0 30px 80px -30px` at 90%). Below `sm` the window goes full-bleed: no radius, no ring, no padding.
- Header, 64px tall, 1px bottom rule at white/8: thread title (display font, 16–17px, weight 600, −0.02em) over a mono metadata line (10.5px, uppercase, 0.12em tracking, white/50), and a 44px round "New thread" icon button on the right.
- The message column is 720px max, centred, 16px gutters on phones and 32px from `sm`, with 36px between messages. It scrolls inside the window and follows the conversation while the reader is at the bottom (a ResizeObserver plus a "pinned" flag that turns off when they scroll up more than 48px).
- **User messages** are compact raised bubbles, right-aligned: `#1c1c1f` fill with an inset top highlight, white text, 15px / 1.55, max-width min(82%, 30rem), radius 18px with the bottom-right corner at 6px, a mono time stamp under it.
- **Assistant replies have no bubble.** A byline (28px white avatar (black letter) with the name's first letter in 14px semibold sans and a small peach status dot, the name in 14px semibold, a mono time) sits over content indented 38px from `sm` so the text aligns with the name. Body 16px / 1.7 at 80% white, measure 64ch, 16px between blocks.
- Lists use a 10×2px peach dash as the marker. Inline `code` sits on a white/6% tint with 5px radius; **bold** goes full white.
- Code block: near-black `#050506` with a white/8% ring, radius 14px. A 44px caption bar shows an uppercase language tag on an 8% white chip, the filename at 55% white, and a Copy button on the right that swaps to a green check and "Copied" for 1.6s. Code in 13px mono at 1.75 leading, scrolling horizontally inside the block. Keep a small regex highlighter: comments `#8f8778` italic, strings `#b9d2a5`, numbers `#f2c38b`, keywords `#f0a37f`, Capitalised names `#f2d9a6`.
- Sources sit under the reply after it finishes: a "Sources" mono label, then wrapping 44px-tall cards (number in a 24px tinted square, title 13px medium, domain in mono). Then a quiet Copy action for the whole reply.
- Composer pinned at the bottom with a 32px fade from the window colour above it: `#111113`, radius 20px, 1px border at white/10%, inset top highlight, a soft shadow that deepens on focus-within. Attachment chips (if any) sit above the auto-growing textarea (16px, grows to 208px, then scrolls). The toolbar holds the attach button and the model label (a peach dot and mono 11px) on the left, a "↵ send · ⇧↵ new line" hint from `md` up, and a round white send button (black arrow, peach on hover) on the right. A one-line mono disclaimer sits under the composer from `sm` up.

**Typography**
- Display (Geist at tight tracking) is only for the thread title. The sans (Geist) carries the conversation. Mono (Geist Mono) carries every piece of metadata: times, tags, the model, hints and the code.

**Colour**
- Black around the window, `#0b0b0c` for it, `#111113` for the composer and white at 3% for source cards, `#1c1c1f` for user bubbles, `#050506` for code, white type at measured opacities, and peach `#ff9a6b` as the only accent (caret, list dashes, status dot, send-button hover, focus rings). Grey text is always white at an opacity.

**Motion**
- The last assistant message streams on mount: 420ms of three pulsing "thinking" dots, then characters arrive in uneven chunks (usually 2–6, sometimes a 10–22 burst) every 18–52ms, with an occasional 160–340ms pause. A peach block caret (0.5em × 1.05em, radius 2px) breathes between 100% and 25% opacity at the end of whatever is streaming, inside paragraphs, list items or code. "writing…" shows in the byline until it's done.
- Sources fade up 6px over 450ms with ease [0.2, 0.8, 0.2, 1] once the stream ends.
- New user bubbles rise 8px over 350ms. Attachment chips expand in height.
- Sending appends the user message and a canned reply (`reply(text)`) that streams the same way. While it streams, the send button becomes a Stop button. Stopping freezes the text where it is and marks the byline "stopped".
- Reduced motion: no streaming, no caret, no entrances. Everything renders complete.

**Behaviour and accessibility**
- Enter sends, Shift+Enter adds a newline, and IME composition is respected (`isComposing`). Send is disabled, at white/15%, when the draft is empty or a reply is streaming.
- The message list is `role="log"`. Each message is an `article` labelled "You said" or "Wren said", with `aria-busy` while it streams.
- The textarea has a visually hidden label. Every icon button has an `aria-label`. Focus rings are 2px peach offset against the window colour. Touch targets are 44px on phones (36px from `sm`).
- The attach button opens a hidden file input; chosen file names become removable chips.

**Don't**
- No bubble around assistant replies, no gradient avatars, no sparkle icon for the assistant, no purple.
- No grey-on-grey: keep secondary text as white at an opacity.
- Don't stream character by character at a constant rate. It reads as a typewriter, not a model.
- Don't let the page scroll horizontally: code scrolls inside its own block.
