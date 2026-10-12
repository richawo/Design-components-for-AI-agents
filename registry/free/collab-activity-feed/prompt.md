Build a workspace activity feed in React + Tailwind CSS v4 with `motion/react` and `lucide-react`. Dark and monochrome: a timeline grouped by day, filtered by type (chips with live counts) and by person (an avatar row), where each event shows what actually changed inline: a word-level diff for prose, a struck-through before and highlighted after for values, two pills for a status move, a quote for a comment.

**Layout**
- Root `<section>` with `@container`; one card (surface, 1px line, 14px radius, inset highlight + deep shadow, overflow hidden). Demo width 720px max.
- Header (hairline below, 20px top, 20/24px sides): `font-display` 18px “Activity” over a mono 11px uppercase “LEDGERLINE · WEBSITE”; on the right a row of 32px initials avatars that filter by person. Under it the type chips (All, Edits, Comments, Status, People), each with a mono count; they wrap onto a second line when the row is narrower than the five chips. A “× Clear” ghost button appears at the end when any filter is on.
- Day groups: a mono 11px uppercase heading (“TODAY” in muted, “SAT 10 OCT” in faint, a hairline that fills the row, and the group’s count at the end).
- Events: a two-column grid, 28px node + content. The node is a 28px circle (surface fill, 1px line) with the type icon (pencil, message, circle-dot, user-plus) at 14px; a 1px rail joins nodes within a day. The sentence is 14px/1.45 muted with the actor and the target in medium ink (“**Mara Ilić** rewrote the headline on **Pricing**”), the time in mono 11px on the right.
- Changes (10px under the sentence):
  - text: a sunken box (8px radius, 1px rule) with the after-sentence in 13px/1.6, removed words struck through on a 12% red tint, added words on a 14% green tint;
  - value: mono 12px, `$24 / seat` struck on red tint → `$29 / seat` on green tint;
  - status: “In review” pill (1px line, faint) → “Approved” pill (raised, faint border, ink);
  - quote: a 2px left rule and the comment in 13px/1.55 muted.
- Empty (a filter with nothing): a ringed icon, “No comments from Sam this week” and an underlined “Show everything”.

**Typography**
- Geist for UI, Geist Display for the heading (tracking −0.025em), Geist Mono for times, counts, days and values. Tabular numerals throughout.

**Colour (monochrome first)**
- Dark (default): surface `#111113`, raised `#17171a`, sunken `#0c0c0e`, line `#232327`, rule `#1b1b1e`, avatar `#1f1f23`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`. Light: `#ffffff`, `#f6f6f7`, `#fafafa`, `#e4e4e7`, `#efeff1`, `#f0f0f2`, ink `#18181b`, muted `#52525b`, faint `#62626b`.
- Semantic diff colours only: added `#4ade80` (light `#15803d`), removed `#f87171` (light `#b91c1c`), always as tints behind ink or faint text, never as text colour.
- One `accent` prop (default: the theme’s ink) for the active chip’s count and the selected person’s 1.5px ring (offset by a 2px surface gap). Unselected people dim to 45% while someone is selected.

**Motion** (ease-out `[0.22, 1, 0.36, 1]`; exits ease-in `[0.4, 0, 1, 1]`)
- Once at 20% in view: the card rises 12px out of an 8px blur; header rows follow 60ms apart; then day headings and events in reading order, 45ms apart from 0.26s.
- Filtering: the active chip’s raised pill slides with `layoutId` on `spring.ui` (500/40); events that stay glide to their new place (`layout="position"`), leaving ones fade up 6px with a 4px blur in 0.18s (`AnimatePresence mode="popLayout"`), arriving ones stagger in 30ms apart; counts update for the selected person.
- Inline diffs collapse and expand with height when toggled (0.3s).
- Reduced motion: 150ms fades only.

**Accessibility**
- Type chips are a `tablist` with roving tabindex and ← →. People are toggle buttons with `aria-pressed` and “Only Mara Ilić” labels. Each day is a labelled `section`. Diffs use real `<ins>` and `<del>` (with sr-only “was”/“now” for values), and each event starts with an sr-only type. The feed is `aria-live="polite"`. 2px focus-visible outlines in ink.

**Don’t**
- No coloured icon per event type, no green or red text, no GitHub-style full-width diff blocks for one-word changes, no avatars from the network, no infinite scroll jank (the groups are static and the motion explains filtering).
