# Booking Slots

Build a standalone React 19, Tailwind v4 and motion/react booking-time chooser with the existing named export, typed API and overridable default demo.

## Layout and type

Keep a focused time chooser: a 30px Instrument Serif heading, compact duration/timezone metadata, a row of date cards with 30px day numerals and 12px month labels, then native time radios in a two-column grid, with 12px horizontal and 8px vertical cell insets so long labels clear the border. Preserve neutral surfaces, restrained rules, a clear selected border and the quiet selected-time footer. Use at least 44px controls and non-shrinking clock/globe icons.

## Interaction

Keep BookingDay, BookingSelection and BookingSlotsProps. Use stable day IDs and slot IDs within each day as React keys so reordering retains focused date/radio controls.

Use undefined value for a local choice, or value with onChange for host control. Controlled radios without a writer are disabled; day browsing remains available. onChange receives an independent dayId/slotId record synchronously, without exposing the stored local object.

Browsing a day is separate from selecting a time. Changing day retains the prior valid selection and its actual day/time receipt until a different available time is chosen. Missing days fall back to the first available day.

Keep native radio-group arrow navigation, Space activation and visible focus. Skip unavailable radios. Refused controlled proposals must not appear selected; null clears the selection.

Only selections that still match a known, available slot render as selected. Empty and fully unavailable days show the same written no-times message; without a valid selection, unavailable views use neutral feedback instead of asking for an impossible choice.

Duration, timezone, weekday, day, month and slot labels are host display strings. Render them without parsing, conversion, automatic sorting or a reservation claim. The host owns booking validation and persistence.

Accept empty/arriving schedules, long labels and independent instances with separate radio names and IDs. Wrap content without document overflow.

## Motion

Enter the whole chooser with opacity and an 8px rise over 320ms. Each keyed day slot grid enters with opacity and a 4px rise over 240ms. Keep the existing 150ms hover/press/focus treatment for available choices. Subscribe to live prefers-reduced-motion changes and stop and settle owned card/grid controls immediately. Remove press transforms for reduced motion.

## Integration

Supply ordered days and slots with stable IDs. All date/time/timezone fields are display labels; resolve scheduling, availability and timezone rules in the host. onChange receives a copied record synchronously. Use value with onChange for controlled acknowledgement; selection does not reserve a slot.

Use the source dark/light palettes, visible focus and 320/390/768/1024/1440/1920px container layouts.
