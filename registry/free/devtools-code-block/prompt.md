Build a code block in React 19 + Tailwind CSS v4 (with `@container` queries) + `motion/react`. It shows a webhook signature in two files, with a tab underline, line numbers, two highlighted lines, a diff of the open file, and a copy button that becomes a check.

**Layout**
- A `section` with `@container`, max-width 920px, 20px radius, surface `#0d0d0f` (light `#ffffff`), an inset 1px hairline, a 1px top highlight and a deep shadow `0 40px 80px -40px rgba(0,0,0,0.9)`. Padding 20px, 24px from `@xl`.
- Chrome: `verify.ts` and `handler.ts` as tabs, with a hairline under the row. Diff and Copy sit on the right and wrap under the tabs when the row is narrow. Tabs and buttons are 44px tall below `@lg`, and 36px or 32px from `@lg`.
- The code sits in a well (`#09090a`, light `#fafafa`), 14px radius, hairline. A line wraps inside the well instead of widening the card. Each row is a line number, then the code. In diff mode a plus or minus sits between them.

**Typography**
- Filenames, numbers and code are Geist Mono. Code is 12.5px, leading 1.65. Numbers are 12px and faint. Diff and Copy are Geist 13px.

**Colour**
- Dark: ink `#ededef`, muted `#98989a`, faint `#7d7d80`. Light: ink `#17171a`, muted `#5d5d5f`, faint `#6f6f72`.
- One accent, default `#7cc4ff`: the active tab’s rule, the highlight’s 2px edge, function names and numbers. Keywords and punctuation are muted. Comments are faint. Strings and other identifiers are ink. Additions use `#5fc284` (light `#23884a`) at 9% behind the line, and the plus is that colour. Removals use `#f07c80` (light `#c2353b`) the same way.

**Behaviour**
- The open file is `verify.ts` or `handler.ts`. Two lines of `verify.ts` are marked: the five-minute window, and the timing-safe compare. `handler.ts` marks the call.
- Diff replaces the source with the change that introduced that code. Removed lines keep no line number. Copy writes the visible result (additions and context, never the removed lines) and swaps the label for a check in the same 4.75rem button. The check returns after 1.6 seconds.
- A call is a name. `from` in an import stays a keyword, because it is not a call.

**Motion**
- The chrome and the code rise 10px out of a 6px blur, 60ms apart, 560ms on `cubic-bezier(0.22, 1, 0.36, 1)`.
- The tab rule travels with `layoutId` on a spring (stiffness 500, damping 40).
- Switching file or diff fades the code and raises it 4px over 220ms. The check scales in over 180ms.
- Reduced motion: opacity only, 150ms or less; no blur, rise, or spring.

**Accessibility**
- Filenames are a tablist. Diff is a toggle with `aria-pressed`. The check is named “Copied”.
- The code region is named with the filename.
- Focus rings are 2px ink outlines, keyboard only. Tabs and buttons are 44px tall below `@lg`.

**Don't**
- Don't paint tokens in more than one accent. Keywords are not blue, and strings are not green.
- Don't fill a highlighted line with a solid band. The edge is 2px and the wash is 8%.
- Don't show a toast for copy. The button itself changes, and it does not change width.
- Don't let a long line widen the page. It wraps inside the well.
