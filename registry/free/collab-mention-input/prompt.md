Build a mention field in React + Tailwind CSS v4 with `motion/react`. Dark and monochrome. It is a note, not a comment thread: `@people` and `#channels` become single tokens in the sentence, and a suggestion list anchors to the caret.

**Layout**
- Root `<section>` with `@container`. One card, max 560px in the demo: surface, 1px line, 14px radius, inset highlight and a deep shadow. No `overflow: hidden`, so the list can leave the card.
- Header: `font-display` 18px semibold “Friday note” (tracking −0.03em) and a mono 11px uppercase workspace (“LEDGERLINE · WEBSITE”).
- Writing well, inset by 20px (24px from `@md`): sunken, 12px radius, 1px line. The field is a contenteditable textbox, min-height 9.5rem, 16px horizontal padding, 15px sans (17px serif) with leading 1.65 (1.55 in serif). Body text is muted; tokens are ink.
- At rest the note already contains two tokens: `@Mara` (accent wash, 5px radius, 1px accent inset) and `#legal` (raised, mono, 1px line). Unknown `@` and `#` stay plain text.
- The list is absolutely positioned at the caret: 8px below the caret rect, or above it when the list would leave the viewport or a clipping workspace pane. Left is clamped inside the well. Width is min(272px, well − 16px). A mono 10px label reads “PEOPLE” or “CHANNELS”. Each row is 44px: a 28px initials avatar (or “#”), the name at 13px medium, and a mono 11px meta line (`@handle`, or “Channel”).
- Footer, under a hairline, only when `showHint`: mono 11px. Idle: “Type @ for a person, # for a channel. Backspace removes the whole token.” Open: “↑↓ to choose · Enter to insert · Esc to dismiss.” No match: “No one matches …” / “No channel matches …”.

**Typography**
- Geist for the UI and the sans note, Geist Display for the heading, Geist Mono for the workspace, channel tokens, list label, meta and hint. Serif (`font-serif`) is a prop for the note only; channel tokens stay mono.

**Colour**
- Dark: surface `#111113`, raised `#17171a`, sunken `#0c0c0e`, line `#232327`, rule `#1b1b1e`, avatar `#1f1f23`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`. Light: `#ffffff`, `#f6f6f7`, `#fafafa`, `#e4e4e7`, `#efeff1`, `#f0f0f2`, ink `#18181b`, muted `#52525b`, faint `#71717a`. Stage (demo only) `#0a0a0b` / `#e9e9ec`.
- One `accent` prop, default `#f5a524`. It tints person tokens (16% fill, 28% inset), the active person’s avatar ring (55%), and the text selection (35%). Channel tokens, avatars and the list stay grey. No per-person hues.

**Motion** (ease-out `[0.22, 1, 0.36, 1]`; exits ease-in `[0.4, 0, 1, 1]`)
- Once at 20% in view: card, header, well and hint rise 12px out of an 8px blur (0.5s, 60ms apart).
- The list arrives 6px down from a 4px blur (0.2s) and leaves in 120ms. The active row’s highlight slides with `layoutId` on spring 500/40. Rows press to 0.98.
- A token inserted from the list fades in through a 4px blur and a 2px rise (280ms). Tokens painted from the initial value do not.
- Reduced motion: 150ms fades, no blur, no token rise, highlight does not travel. Read preference changes while mounted. Enabling reduction cancels current entrance and native token animation, settles the suggestion list and keeps the same editor and caret.

**Behaviour**
- `@` or `#` after whitespace (or at the start) opens the list. The query is the handle fragment at the caret. People match a handle prefix or a name that contains the query; channels match a name prefix. Five rows max. Arrow keys move, Enter or Tab inserts, Escape dismisses. A click on a row uses `pointerdown` preventDefault so the field does not blur first.
- Insert deletes the `@query`, drops an atomic `contenteditable=false` token, then a nbsp, and parks the caret after that space. People store `@handle` and display `@First`. Channels store and display `#name`.
- Backspace at the start of a text node deletes the previous token as one piece. Enter inserts a line break instead of a new block. Paste is plain text.
- Serialize nested browser paragraph wrappers recursively. Keep every line break and blank paragraph, normalize CRLF and non-breaking spaces, and store token handles rather than their display names. Reposition an open list when its editor scrolls.
- A scripted click, and a real click in the empty area under the writing, moves the caret to the end. A real click on a word keeps the browser’s caret.
- `value` is painted once on mount. Rebuilding the DOM on each keystroke would throw the caret away. `onChange` receives the serialized note.

**Accessibility**
- The textbox is `aria-multiline`, named by the title, with `aria-autocomplete=list`, `aria-expanded`, `aria-controls` and `aria-activedescendant`.
- Options are `role=option` inside a listbox. Avatars are `aria-hidden`. Tokens expose “Mention @Mara” / “Channel #legal”.
- A polite live region announces “Mentioned Priya Raman” or “Added #legal”. The hint is also polite.
- 2px focus-visible outline in ink, offset 2px.

**Don’t**
- Don’t build a second comment thread: no avatars of authors, no resolve, no reply stack.
- Don’t tint channel tokens with the accent, and don’t give each person their own hue.
- Don’t let a token split across a line, and don’t require two backspaces to delete one.
- Don’t anchor the list to the field’s top or bottom. It follows the caret.

The editor, title, placeholder and atomic tokens select their direction from their contents, preserving stored handles and the active caret.
