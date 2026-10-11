Build a presence bar in React + Tailwind CSS v4 with `motion/react`. Dark and monochrome. It answers two questions and nothing else: who is in this document, and what they are doing. Idle people fade. Following someone pins their sentence.

**Layout**
- Root `<section>` with `@container`. One card, max 560px in the demo: surface, 1px line, 14px radius, inset highlight and a deep shadow.
- Header: `font-display` 18px semibold title (“Pricing”, tracking −0.03em) and a mono 11px uppercase workspace (“LEDGERLINE · WEBSITE”). On the right, a tabular 20px count and the word “HERE” in mono 11px.
- Under a hairline, a row. Four 44px buttons, 4px apart, each holding a 32px initials avatar. The first active person has a 6px ink dot on the avatar’s top right, with a 2px surface ring so it sits on the card.
- The sentence sits to the right of the avatars from `@md`, and on its own line below them when the card is narrower. It does not jump between those two placements as the sentence gets longer; a long one wraps inside its column. 15px, leading 1.4: the first name and the place (“Pricing”, “Legal”) are medium ink, the verb is muted. “Mara is editing Pricing.”
- Following adds a mono 11px “FOLLOWING”, a faint middot, and the activity without “is” (“editing Pricing”, “commenting in Legal”, “reading the headline”, “idle”). A “STOP” button sits at the end of that line.
- Idle avatars (Jonas) are at 50% opacity until hovered or followed. No names under the avatars: the sentence is the name.

**Typography**
- Geist for the sentence, Geist Display for the title and the count, Geist Mono for the workspace, “HERE”, “FOLLOWING” and “STOP”.

**Colour**
- Dark: surface `#111113`, raised `#17171a`, line `#232327`, rule `#1b1b1e`, avatar `#1f1f23`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`. Light: `#ffffff`, `#f6f6f7`, `#e4e4e7`, `#efeff1`, `#f0f0f2`, ink `#18181b`, muted `#52525b`, faint `#71717a`. Stage (demo only) `#0a0a0b` / `#e9e9ec`.
- One `accent` prop, defaulting to the theme ink. It is only the 2px ring around the followed avatar. The live dot stays ink. No per-person hues, and the accent is never text.

**Motion** (ease-out `[0.22, 1, 0.36, 1]`; exits ease-in `[0.4, 0, 1, 1]`)
- Once at 20% in view: the card, the header and the row rise 12px out of an 8px blur (0.5s, 60ms apart).
- The count rolls when it changes (3px blur, 0.32s).
- The sentence cross-fades with a 4px rise and a 3px blur (0.22s) when the person changes, and again when follow starts.
- The follow ring travels with `layoutId` on spring 500/40.
- The live dot breathes between opacity 1 and 0.35 over 2.4s, only while the bar is in view.
- Avatars press to 0.97. Idle opacity eases over 200ms.
- Reduced motion: 150ms fades, no ring travel, the dot stays solid.

**Behaviour**
- Hover previews that person’s sentence. Click follows them; click again, or Stop, clears it. While someone is followed, hover does not steal the sentence.
- Arrow keys move between the avatar buttons.
- `showIdle` hides idle people and drops the count. If the followed person disappears, follow clears.
- Empty: “No one else is in this document.”

**Accessibility**
- The avatar row is a toolbar labelled “People in this document”. Each button is `aria-pressed` and named with the person and their activity (“Priya Raman, commenting in Legal”).
- The count has an accessible name (“4 here”). Avatars and the live dot are `aria-hidden`.
- A polite live region announces only follow, not hover.
- 2px focus-visible outlines in ink.

**Don’t**
- Don’t draw multiplayer cursors, carets or selections. This is a bar, not a canvas.
- Don’t give each person a hue, and don’t tint the sentence with the accent.
- Don’t hide what someone is doing behind a tooltip. The sentence is always visible.
- Don’t leave an idle person at full strength. Fade is how the bar says they are quiet.
