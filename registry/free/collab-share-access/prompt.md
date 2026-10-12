Build a share-access panel in React + Tailwind CSS v4 with `motion/react` and `lucide-react`. Dark and monochrome: typed emails turn into validated chips, a compact menu sets the role, people with access each have a role menu with Remove (and an Undo bar), general access steps from Restricted to Organisation to Anyone with the link, and Copy link morphs into a tick.

**Layout**
- Root `<section>` with `@container`; one card (surface, 1px line, 14px radius, inset highlight + deep shadow). No `overflow: hidden` on the card, so menus can float past its edge. Demo width 600px max.
- Header: `font-display` 18px semibold “Share” + the doc title in muted quotes (truncates), and a mono 11px uppercase “4 PEOPLE” count on the right.
- Invite row: a sunken field (min 44px, 12px radius) that wraps chips, a text input (“Add people by email”) and, inside the field on the right, a quiet role trigger (“Can edit ⌄”). Beside it an accent **Invite** button 44px tall (stacks under the field below `@md`). It reads “Invite 3” when several valid chips are waiting.
- Chips: 28px tall, 6px radius, raised fill + 1px line, email text 13px, a 24px × button. Invalid chips: dashed 1px danger border, danger text, alert icon.
- A 12px line under the field: the hint (“Separate with commas or Enter. People outside northwind.co join as guests.”) or, when something’s wrong, the first problem in danger (“"lu@nw" isn’t a full email address. Fix it or remove the chip.”).
- “PEOPLE WITH ACCESS” in mono 11px, then rows: 32px initials avatar (pending invites get a dashed ring instead of a fill), name 14px medium + “(you)” + a mono “GUEST” tag for outside domains, email or “Invite sent · waiting to accept” in 12px faint, and the role trigger on the right (“Owner” as plain faint text for the owner).
- Footer (hairline above): an Undo bar when someone was just removed, then “GENERAL ACCESS”: a 36px icon tile (lock, building or globe), the level as a menu trigger in ink, “· can view” as a second menu when the link is open, a one-line consequence in 12px faint, and a fixed-width 116px **Copy link** button.
- Menus: a 256–288px popover (raised, 12px radius, 1px line, deep shadow) of options with a label (13px medium) and a hint (12px faint); a ✓ in the accent marks the selected one; “Remove access” sits under a hairline in danger. Footer menus open upward.

**Typography**
- Geist for UI, Geist Display for the heading (tracking −0.025em), Geist Mono for section labels, counts and tags.

**Colour (monochrome first)**
- Dark (default): surface `#111113`, raised `#17171a`, sunken `#0c0c0e`, line `#232327`, rule `#1b1b1e`, avatar `#1f1f23`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`, danger `#f87171`. Light: `#ffffff`, `#f6f6f7`, `#fafafa`, `#e4e4e7`, `#efeff1`, `#f0f0f2`, ink `#18181b`, muted `#52525b`, faint `#71717a`, danger `#b91c1c`.
- One `accent` prop (default: the theme’s ink) fills the Invite button and colours the selected ✓ and the Copied tick. Button text is computed black or white from the accent’s luminance. Danger is semantic only (invalid chips, Remove).

**Motion** (ease-out `[0.22, 1, 0.36, 1]`; exits ease-in `[0.4, 0, 1, 1]`; collapses ease-in-out `[0.65, 0, 0.35, 1]`)
- Once at 20% in view: card rises 12px out of an 8px blur; header, invite row, section label and rows follow (60ms, then 50ms apart from 0.24s); the footer lands last.
- A comma, semicolon, space, Enter or Tab commits the typed text as a chip (0.9 → 1 scale, 3px blur clearing, 0.2s); pasted lists split into many chips; Backspace in an empty field removes the last chip; blur commits too.
- Invite: valid chips leave the field and their people rise into the list as pending rows; invalid chips stay put with the error line.
- Remove: the row collapses (height, padding and a 4px blur over 0.28s) and an Undo bar unfolds above General access with a hairline that drains over `undoMs`. Undo re-inserts the person at their old index.
- Menus open with a 6px offset, 0.98 scale and 4px blur (0.2s); the highlight slides between options with `layoutId` on `spring.ui` (500/40). The access icon swaps with a small spring rotate; the consequence line cross-fades.
- Copy link: the label rolls up to “✓ Copied” for 1.6s, the button keeps its width.
- Reduced motion: 150ms fades only.

**Accessibility**
- Menu triggers have `aria-haspopup="listbox"`, `aria-expanded` and an `aria-label` (“Access for Mateo Herrera”); the popover is a `listbox` of `option`s with ↑/↓, Enter/Space, Esc and Tab; it closes on outside press. The email input has `aria-invalid` and `aria-describedby` pointing at the live hint/error line. Chip × buttons say “Remove ines@northwind.co”. The Undo bar is a `status`. 2px focus-visible outlines in ink.

**Don’t**
- No modal-in-a-modal for roles, no coloured role badges, no avatar photos, no silent failure for bad emails, no removal without Undo, no Copy button that changes width.
