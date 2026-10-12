Build an invite panel in React + Tailwind CSS v4 with `motion/react` and `lucide-react`. Dark and monochrome. It is a seating chart, not a share dialog: a meter shows seats taken and a ghost of the people about to join, a paste well turns a block of emails into rows with a role each, bad addresses stay flagged in place, and Send flies each valid avatar down into a pending list.

**Layout**
- Root `<section>` with `@container`. One card, max 560px in the demo: surface, 1px line, 14px radius, inset highlight and a deep shadow. No `overflow: hidden`, so role menus can leave the card.
- Header: `font-display` 18px semibold “Invite people” (tracking −0.03em) and a mono 11px uppercase workspace (“LEDGERLINE · WEBSITE REVIEW”). On the right, a tabular 32px seat count (tracking −0.04em) with “OF 8” in mono 11px underneath.
- Meter: a row of 8px pills, 3px apart, one per seat. Taken pills are ink. Valid unsent rows preview as an 18% ink fill with a 1px inset line. Empty pills are the line colour. Seats past the plan are a danger wash with a danger inset line. Under the meter, 13px muted copy: “3 ready · the studio fills”, or “4 ready · 1 past the 8 included — sending is still allowed”.
- Team row (optional): five 24px initials overlapping by 6px, a 2px surface ring, then “5 on the team · Sam, Mara, Jonas, Priya, Pablo” in 13px, truncated.
- “TO INVITE” in mono 11px. A sunken well (12px radius, 1px line) holds the rows and, at the bottom, the paste field (36px, 14px, placeholder “Paste emails, or type one”).
- A valid row: 28px avatar, name 14px medium, a mono “GUEST” tag when the domain isn’t the company’s, email 12px faint, a quiet role trigger (“Editor ⌄”) and a 32px remove button. An invalid row replaces the avatar with an alert icon, paints the pasted text and the reason in danger, and draws a 2px danger rail on the left. No role menu.
- Under the well: a 12px hint (“2 still need a look. New addresses join as Editor.”) and, from `@md`, an accent Send button 44px tall reading “Send 3 invites”. Below `@md` the button is full width under the hint, and each role trigger drops onto its own line under the email so the name never truncates. The team’s first names hide below `@md`; “5 on the team” stays.
- Footer, under a hairline: “PENDING” plus a tabular count. Empty state is a dashed tray, min 64px, “They’ll land here, one seat each.” After sending, rows: the same avatar, name, “Invited · Editor · email” in 12px faint, Guest tag, and withdraw.

**Typography**
- Geist for UI, Geist Display for the heading and the seat figure, Geist Mono for the workspace, section labels, the seat caption and the Guest tag.

**Colour**
- Dark: surface `#111113`, raised `#17171a`, sunken `#0c0c0e`, line `#232327`, rule `#1b1b1e`, avatar `#1f1f23`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`, danger `#f87171`. Light: `#ffffff`, `#f6f6f7`, `#fafafa`, `#e4e4e7`, `#efeff1`, `#f0f0f2`, ink `#18181b`, muted `#52525b`, faint `#71717a`, danger `#b91c1c`. Stage (demo only) `#0a0a0b` / `#e9e9ec`.
- One `accent` prop, defaulting to the theme ink, fills Send and the check in the open role menu. Button text is black or white from the accent’s luminance. Danger is only for bad addresses and over-seat pills.

**Motion** (ease-out `[0.22, 1, 0.36, 1]`; exits ease-in `[0.4, 0, 1, 1]`)
- Once at 20% in view: the card, header, meter, team and well rise 12px out of an 8px blur (0.5s, 60ms apart). Seat pills scale in from the left, 35ms apart, after 0.18s. The seat count and the Send count roll on change (32% blur, 0.32s).
- Comma, semicolon, space, Enter or Tab commits the field; a paste with any separator splits the whole block. Backspace in an empty field removes the last row. Blur commits too. A ref holds the field text so a click on Send, which blurs first, cannot add the same address twice.
- Send removes valid rows and mounts them under Pending with the same `layoutId` on the avatar, so the initials fly (spring 380/34). Invalid rows stay. Withdrawing a pending invite drops the seat count.
- Role menus open 6px up from 0.98 scale with a 4px blur (0.2s). The highlight slides with `layoutId` on spring 500/40.
- Reduced motion: 150ms fades, no flight, pills do not scale.

**Accessibility**
- The meter is an image with an accessible name (“5 of 8 seats taken. 3 more if you send.”). The paste field has `aria-invalid` and `aria-describedby` the hint, which is a live region along with the seat sentence. Role triggers are listboxes: `aria-haspopup`, `aria-expanded`, ↑/↓, Enter/Space, Esc, Tab, and they close on an outside press. Remove and withdraw buttons name the address or person. Avatars are `aria-hidden`. 2px focus-visible outlines in ink.

**Don’t**
- Don’t make it a second share dialog: no link access, no per-person access list, no undo-on-remove of teammates.
- Don’t tint avatars per person, don’t use the accent as text, and don’t block Send when the invite goes past the included seats — show it and allow it.
- Don’t drop invalid addresses on the floor. Don’t close a role menu on blur in a way that eats the option click.
