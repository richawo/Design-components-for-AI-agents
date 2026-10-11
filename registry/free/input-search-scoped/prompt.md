Build a scoped search bar in React 19 + Tailwind CSS v4 + `motion/react`, with `lucide-react` icons. It understands a small query grammar: typing `in:` or `from:` offers that operator's values, and a finished token turns into a removable chip inside the field. Focusing the empty field shows recent searches, and the ⌘K keycap at rest morphs into the clear button once there is something to clear. Results are the host's job: the component is the field and its suggestions, and it reports `{ query, scopes }`.

**Layout**
- Root: `@container`, full width up to 600px, `font-sans`. The suggestion panel is absolutely positioned 8px under the field, same width, inside the root (no portal; document how to lift it).
- Field: one row, 48px tall (md) or 56px (lg), radius 12px / 14px, side padding 14px / 16px. In order: an 18px / 20px search glyph, a horizontally scrolling row (scrollbar hidden, scrolled to the end whenever the chips change) holding the chips and then the text input (flex 1, min width 9ch), then the right slot.
- Chips: 26px / 30px tall, radius 7px, 8px left padding and 4px right, 6px apart. Inside: the operator key in mono 11px, the value's glyph (lucide icon at 62% of the chip, or a round initials avatar for people), the short name (13px / 14px), and an 18px remove button with its hit area extended 9px up and down.
- Panel: radius 14px, 6px inner padding. A mono header row (10.5px, uppercase, 0.08em tracking) with the mode's title on the left and its key hint on the right from the `@md` container width. Rows 40px / 44px, radius 9px, 10px side padding, 12px gap: a 26px tile (radius 7px, hairline) with an icon or initials, the label, a 13px detail line from `@sm`, then a mono 11.5px tabular meta (a count like 1,284, a team, or "12m") and a 22px slot for the active row's key.
- Footer (recents and idle modes, when scopes are on): a hairline above, "Narrow with" in 12.5px muted, then one 28px mono button per operator (`in:` `from:` `is:`).

**Panel modes**
- Recents: empty field, recents on. Each row: history tile, mini chips (20px, mono 10.5px key) for its scopes, the query, the time. Nothing is active at first, so Enter never reruns a search by surprise.
- Values: the trailing token is `key:partial` for a known operator. Header reads `in: · Search in`. Values filter by id or any word of the label starting with the partial (a leading @ is ignored); the matched run is drawn in the accent at weight 600. No match: "Nothing in `in:` starts with “x”. It will be searched as plain text."
- Query: text or chips present. First row "Search for “onboarding flow”" with the scope summary ("in Docs · from Mara") muted beside it; "Search everything" with chips only. If the last bare word is the start of an operator key ("i", "fro"), the matching operators follow as rows ("Narrow to a space, like Docs or Issues").
- Idle: recents off or empty, scopes on: the footer alone.

**Behaviour**
- A token becomes a chip when its value is picked (click, Enter or Tab) or when an exact value is followed by a space. One chip per operator: a second `in:` replaces the first in place and its name cross-fades.
- Backspace at the start of the input arms the last chip (brighter fill, 1px ring); a second Backspace removes it. Any other key disarms.
- Arrow keys move the active row and wrap; Enter picks it, or submits; Tab completes values and operators only; Esc closes the panel, a second Esc clears. Picking a recent restores its text and chips and submits. ⌘K / Ctrl K focuses and selects the field when `shortcutHint` is on.
- Hovering a row makes it active. Rows and footer buttons prevent mousedown, so the input keeps focus. Leaving the root (blur to outside) closes the panel.

**Typography**
- Input 16px (md) / 18px (lg), tracking −0.005em, so iOS never zooms. Rows 14px / 15px. Meta and keycaps in Geist Mono, tabular numerals. The keycap reads "⌘ K" in mono 11.5px with 3px between the glyphs.

**Colour (monochrome; one accent)**
- Dark: stage `#050506`, field `#0e0e10` with an inset 1px ring `rgba(255,255,255,0.09)` (0.17 hover, 0.32 focus) and `inset 0 1px 0 rgba(255,255,255,0.04)`; panel `#111113` with a 0.08 ring and `0 28px 64px -20px rgba(0,0,0,0.9)`. Ink `#f4f4f5`, body `#c9c9cf`, muted `#a1a1aa`, faint `#8a8a93`. Chips `rgba(255,255,255,0.07)` with a 0.1 ring, armed 0.16. Active row 0.065. Tiles `#1b1b1e`.
- Light: stage `#f1f1f2`, field and panel `#ffffff`, rings `rgba(17,17,19,0.12)` / 0.22 / 0.4, ink `#111113`, body `#3f3f46`, muted `#52525b`, faint `#6b6b74`, chips `rgba(17,17,19,0.05)`.
- `accent` (default: the theme's ink) colours the matched letters, the caret, the active row's key and a 4px focus halo mixed to 14%.

**Motion**
- The clear morph: one button animates width, height, radius and fill between a 38×22px keycap (radius 6) and a 26px circle over 300ms `cubic-bezier(0.65, 0, 0.35, 1)`; the "⌘ K" glyphs and the X swap inside it with scale 0.6 and a 3px blur. With the hint off, the circle grows from width 0.
- Chips arrive from scale 0.88 and a 4px blur in 220ms ease-out `[0.22, 1, 0.36, 1]` and settle with a layout spring (stiffness 500, damping 40).
- The panel opens from y −6, scale 0.985 and a 4px blur in 240ms, closes in two thirds of that with ease-in, and its height follows its content (measured with ResizeObserver) over 280ms. Mode changes cross-fade with a 4px offset and a 3px blur. Rows stagger in 40ms apart (capped after five), and the active-row fill travels between rows with a shared `layoutId` on the same spring.
- Reduced motion: no transforms, blur, stagger or springs; 140ms opacity fades only.

**Accessibility**
- The input is a `combobox` with `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; the list is a `listbox` of `option`s with `aria-selected`. Chips are a labelled `list`; each remove button is labelled "Remove scope in: Docs". The clear button is "Clear search"; while it is a keycap it is `aria-hidden` and out of the tab order. `aria-keyshortcuts` names the shortcut. A polite live region announces added, changed and removed scopes, searches and clears. The closed panel is `inert` and `aria-hidden`. Keyboard focus shows a 2px outline offset 2px.

**Don't**
- No results list, no network calls, no fake loading spinner. No coloured chips per operator, no glow, no gradient. Don't let the panel resize the page or push content down. Don't render the ⌘K hint and an X side by side; it is one shape that changes.

**Robustness**
Resolve all complete known tokens in pasted text as well as individually typed tokens. Preserve unknown operators and values as free text. Never submit or complete a suggestion during IME composition.
