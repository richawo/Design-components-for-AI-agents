# Weekly Agenda

Build a standalone React 19, Tailwind v4 and motion/react weekly agenda with the existing named export, typed API and overridable default demo.

## Layout and type

Keep a compact weekly schedule: a 20px sans heading and timezone, a travelling pressed-day selector, a 30px Instrument Serif date heading and time-anchored event disclosures. Preserve the 48px time gutter, 14px event titles and notes, 12px mono time metadata, 44px controls and neutral ruled card. Notes open inside each event; the work remains the focus.

## Interaction

Keep AgendaEvent, AgendaDay and WeekAgendaProps. Use stable unique day IDs and stable event IDs within each day as React keys so collection reordering retains focused buttons and open event state.

Only one day is selected and one event disclosure is open at a time. Day buttons expose aria-pressed; event buttons expose aria-expanded and instance-scoped aria-controls. Native Enter and Space activate both controls. Changing day closes event details.

onEventSelect receives a new flat event snapshot synchronously on each disclosure activation, including closing it. Do not let callbacks mutate the host days/events. Local disclosures work without a callback; the host owns navigation and persistence.

The initial defaultDay selects a matching day, with the first available day as fallback. Keep a written empty-day state and a no-dates state for an empty list, and accept later-arriving schedules.

Date, start, end and timezone values are host display labels. Render them as provided; do not add parsing, timezone conversion, sorting, asynchronous saves or invented calendar rules.

Wrap long titles, locations and notes without document overflow. Keep independent agendas and disclosure IDs separate.

## Motion

Enter the whole agenda with opacity and an 8px rise over 320ms. Move the shared day indicator over 220ms; enter each keyed day list with opacity and a 6px rise over 250ms; rotate disclosure chevrons over 150ms. Subscribe to live prefers-reduced-motion changes. Stop and settle owned entry/list controls immediately and use a static selected-day indicator with no layout travel.

## Integration

Supply ordered days with stable day IDs and stable event IDs within each day. Date/time/timezone strings are display labels; resolve scheduling and timezone rules in your host. onEventSelect receives a copied record synchronously on open and close, while disclosure state stays local.

Use the source dark/light palettes, visible focus and 320/390/768/1024/1440/1920px container layouts.
