# Invoice list

Build an invoice list in React 19 with Tailwind CSS v4 and motion/react. One card, not a page. Copperline’s ledger has five invoices, newest first: INV-1046 on 2 Oct 2026 for $48.00, open; INV-1042 on 24 Sep for $128.00, paid; INV-1038 on 24 Aug for $128.00, paid; INV-1031 on 24 Jul for $96.00, paid; INV-1019 on 24 Jun for $96.00, failed. One invoice is open, so the subtitle is `1 open · $48.00`.

## Layout

A `section` with max-width 560px, 20px radius, padding 20px (28px from `@sm`). The stage is `#060607` (light `#f4f4f5`), the card centred with `px-4 py-14`.

Header: mono `BILLING`, heading `Invoices` at 22px, then the open total. If nothing is open, the line reads `Nothing open`.

Under that, a four-column filter: All, Paid, Open, Failed, each with its count. One is selected. The pill is a track inside a raised capsule.

The list is a table when the card is at least 448px wide, and a stack of cards below that. Table columns: Invoice, Issued, Status, Amount, and a download with no visible header. Cards put the id, date and status on the left, the amount and the download on the right. A mono line under the list reads `5 of 5`, and follows the filter.

## Status

Paid is muted. Open is the accent: a 6px dot and the word in accent text. Failed is the ink, medium weight, not red and not a banner. Amounts are tabular.

## Download

A 44px button. At rest it is a hairline square with a down arrow. Pressing it fills with the accent and the arrow becomes a check that draws. The accessible name changes from `Download INV-1046` to `INV-1046 saved`. It does not open a dialog.

## Typography

Eyebrows and the filter counts: mono 11px. The filter labels are 12.5px medium. Heading: font-display 22px, weight 600, tracking −0.025em. Row ids and amounts: 14px in the table, 15px on the cards. Dates 13px or 13.5px, muted, tabular.

## Colour

Same greys as the rest of billing. Dark surface `#131317`, raised `#1a1a1f`, track `#24242b`, ink `#f4f4f5`, muted `#8a8a93`, hairline `rgba(255,255,255,0.08)`. Light surface `#ffffff`, raised `#f6f6f7`, track `#ececef`, ink `#18181b`, muted `#6b6b75`, hairline `rgba(24,24,27,0.09)`. Accent default `#7dd3a8`. On light, accent text is `color-mix(in oklch, accent 45%, ink)`. Text on the accent button is `#07130d`.

## Motion

Entrance: header, filter at 80ms, list at 160ms. Rise 10px out of an 8px blur over 500ms, cubic-bezier(0.22, 1, 0.36, 1), then clear the filter. The selected filter pill travels with a spring (stiffness 500, damping 40). The list fades and rises 6px when the filter changes, and its height eases over 320ms. The download icon swaps over 180ms; the check draws over 320ms. Press scale 0.97. Reduced motion: opacity only, the pill jumps, the check is already drawn.

## Accessibility

The filter is a radiogroup. Arrow keys, Home and End move the selection and focus. The table has a caption and column headers; the invoice id is a row header. Cards are a list. The download is a button with a name that includes the invoice id. Focus is a 2px ink outline, 2px offset, keyboard only.

## Don’t

Don’t add a red failed state, a status rainbow, or a network logo. Don’t make the row itself the download. Don’t keep the table at 390: the columns will crush. Don’t use a modal to confirm the save.
