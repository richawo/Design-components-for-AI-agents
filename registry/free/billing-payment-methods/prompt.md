# Payment methods

Build a saved-cards list in React 19 with Tailwind CSS v4 and motion/react. One card, not a page. Copperline has two cards and no network logos. •••• 4242, Ines Varga, expires 08/28, is the default. •••• 1881, Jonah Adeyemi, expires 04/28, is the other. The accent outline lives on the default and travels when it changes.

## Layout

A `section`, max-width 560px, 20px radius, padding 20px (28px from `@sm`). Stage `#060607`, light `#f4f4f5`, centred with `px-4 py-14`.

Header: mono `BILLING`, heading `Cards` at 22px, then `Default is •••• 4242`.

The cards sit in one column below 448px and two columns from there. Each is a dark object, aspect 1.7, with Copperline in small caps, a warm chip (`#d9c7a3`), `•••• 4242`, the holder and the expiry. Under it: `Default` with a 6px accent dot, or a `Set default` button, and `Remove` on the right.

Removing a card takes it out of the grid and leaves a row in the list: `•••• 4242 removed` and `Undo`. Undo puts the card back, including its default if it had it. There is no toast.

`Add a card` opens a form in that same spot: name, last 4, expiry as MM/YY, and Cancel. Add fills with the accent only when the name has two characters, the last 4 are digits, and the expiry is a real month. A duplicate last 4 is refused in ink, not red.

## Typography

Eyebrow mono 11px, uppercase, tracking 0.08em. Heading font-display 22px, weight 600, tracking −0.025em. Card number mono 13px (14px from the two-column width), tracking 0.14em. Holder and expiry mono 10.5px. Actions 13px. The form fields are 14px in an 44px control.

## Colour

The billing greys. Dark surface `#131317`, raised `#1a1a1f`, track `#24242b`, ink `#f4f4f5`, muted `#8a8a93`, hairline `rgba(255,255,255,0.08)`. Light surface `#ffffff`, raised `#f6f6f7`, track `#ececef`, ink `#18181b`, muted `#6b6b75`. Accent `#7dd3a8`. On light, accent text is `color-mix(in oklch, accent 45%, ink)`. Text on the accent button is `#07130d`. The cards stay dark in both themes (`#2c2c34` into `#121216`). The chip `#d9c7a3` is the card’s material, not a second UI colour.

## Motion

Entrance: header, cards at 100ms, the add button at 200ms. Rise 10px out of an 8px blur over 500ms, cubic-bezier(0.22, 1, 0.36, 1), then clear the filter. The default outline springs from one card to the other (stiffness 420, damping 36). A removed card fades; the undo row rises 6px. Press scale 0.985 on Add a card, 0.98 on the form’s Add. Reduced motion: opacity only, the outline jumps, no scale.

## Accessibility

Set default, Remove, Undo, Cancel and Add are buttons. The subtitle is a polite live region, and so is the undo row. The form fields are labelled. Errors are an alert. Focus is a 2px ink outline, 2px offset, keyboard only.

## Don’t

Don’t draw Visa, Mastercard or any other network mark. Don’t use a toast library for undo. Don’t make Remove red. Don’t disable Add: an incomplete form explains itself when submitted, and a complete one is the accent.
