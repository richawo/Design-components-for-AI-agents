Build a public status page in React 19 + Tailwind CSS v4 (with `@container` queries) + `motion/react`. It reports one product: a sentence for the current condition, a 90-day strip for each component, the open incident as a timeline, and a subscribe field whose button becomes a check.

**Layout**
- A `section` with `@container`, max-width 920px, 20px radius, surface `#0d0d0f` (light `#ffffff`), an inset 1px hairline, a 1px top highlight and a deep shadow `0 40px 80px -40px rgba(0,0,0,0.9)`. Padding 20px, 24px from `@xl`.
- Header: a status dot and the product name in mono 12.5px; on the right, “Updated 14:41 UTC” in mono 11px.
- The condition is a 22px sentence (26px from `@lg`), tracking −0.03em, leading 1.15, with the status word — Operational, Degraded or Outage — in mono 12px on the right. One muted 14px line underneath.
- Five components sit in a well (`#09090a`, light `#fafafa`), 14px radius, hairline. Each row is the name, the uptime percentage, and 90 day columns. A wide track keeps them in one strip. When a day would be narrower than 5px, the ninety days wrap into two or three equal rows so the stitches stay a comb, with a 1px gap, the same idea as the wide strip. A component that is not up gets a 2px edge in its status colour and a raised row. Quiet days are 8px tall (6px from `@lg`). Degraded and down days are 14px (12px from `@lg`). The day under the pointer fills its cell. The row then names that day in mono 12px. “13 Jul” and “Today” sit once, under the list.
- The incident has an uppercase mono label, a 15px title, and a hairline rail. Time and title share a line; the note is 13.5px. The latest dot uses the status colour. When nothing is open, one line reads “No open incidents.”
- Subscribe sits under a hairline. The field and button share a row. The button is 7.5rem wide below `@lg` and 8rem from `@lg`. Both are 44px tall below `@lg` and 36px from `@lg`.

**Typography**
- The sentence is Geist. Names are 14px. Incident copy is 13.5px, leading 1.55. Times, dates and percentages are Geist Mono, tabular numerals.

**Colour**
- Dark: ink `#ededef`, muted `#98989a`, faint `#7d7d80`, hairlines `rgba(255,255,255,0.08)`. Light: ink `#17171a`, muted `#5d5d5f`, faint `#6f6f72`.
- Up days are 28% ink, not green. Down days are `#f07c80` (light `#c2353b`). Operational is `#5fc284` (light `#23884a`).
- One accent, default `#7cc4ff`. On a light surface it is mixed 62% toward black. It colours the degraded signal only: the dot, the word Degraded, degraded days, a degraded percentage, and the latest incident mark. The day under the pointer is ink, so it stays visible on top of a degraded or down day.

**Behaviour**
- Each row is one slider. Moving the pointer names that day in the row: “10 Oct · Degraded 14 min · Retries are catching up.” A tap does the same. A horizontal drag scrubs. A vertical drag scrolls the page. Arrow keys step a day. Home and End jump to the ends.
- Columns are integer widths with a 1px gap, so ninety days stay separate at 390px and never overflow the row. A narrow track wraps into two or three equal rows of 8px stitches, packed tight so the phone card is the same height as the desktop card. Oldest day at the top left, today at the bottom right.
- Uptime is the share of 90 × 1,440 minutes that were not lost. The figure eases the last 0.8 points into place. A component that is not up shows that figure in its status colour.
- Degraded: Webhooks lost a few minutes on 7–10 Oct 2026, and the incident is being monitored. Outage: the API is down today and webhooks are still delayed. Operational: every strip is quiet and there is no incident.
- Subscribe accepts one address. An empty or invalid field says “Enter an email address.” and does not submit. A valid one swaps the button label for a check in the same box and confirms the address.

**Motion**
- Header, sentence, strips, incident and subscribe rise 10px out of a 6px blur, 60ms apart, 560ms on `cubic-bezier(0.22, 1, 0.36, 1)`.
- Each day grows from the baseline over 400ms, 1.8ms after the previous one.
- The column under the pointer travels on a spring (stiffness 500, damping 40). The day sentence opens over 220ms and closes over 140ms.
- The check scales in over 180ms. The incident swaps over 320ms.
- Reduced motion: opacity only, 150ms or less; no blur, rise, scale, travel, or count.

**Accessibility**
- Each row is a slider named with the component. `aria-valuetext` is the day under the pointer.
- The email field has a visible label. The hint and the confirmation are `aria-live="polite"`. The check is named “Subscribed”.
- Focus rings are 2px ink outlines, keyboard only. The row, the field and the button are at least 44px tall below `@lg`.

**Don't**
- Don't paint healthy days green. Quiet days stay a low-contrast ink.
- Don't fuse the ninety days into one bar. Wrap a narrow track into two or three rows so each stitch stays readable, and keep the 1px gap.
- Don't use a floating tooltip. The day is named in the row, where it cannot clip.
- Don't repeat the date axis under every component.
- Don't give degraded days a second hue. They use the accent.
- Don't capture the pointer on a vertical drag. That gesture scrolls the page.
- Don't let the subscribe button change width when the check appears.
- Don't pulse the status dot.
