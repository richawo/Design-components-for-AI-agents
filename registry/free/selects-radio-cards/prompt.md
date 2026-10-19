# Radio Cards

Build a self-contained React 19, Tailwind v4 and motion/react component with the existing typed API, named export and overridable default demo.

## Layout and type

A native radio group presented as three response-style cards, with a 20px group heading, 18px option labels, 14px descriptions and 12px monospaced notes. Each card pairs a quiet direction icon with a clear circular selection mark. Keep neutral graphite surfaces, 20px card padding and generous spacing; form-control boundaries meet 3:1 contrast. Use three columns only when the component container is wide enough, otherwise stack cards.

## Interaction

Preserve RadioCardOption, RadioCardsProps and the named RadioCards export. Use native radios inside labels and an instance-scoped fieldset group, with an accessible legend and visible heading.

Use defaultValue for local state, or value with onChange for controlled acknowledgement. Controlled radios without a writer are disabled. Retain the host selection when a proposal is refused; an empty or unknown ID is not selected.

Use stable unique option IDs as React keys so host reordering keeps the focused native radio. Keep arrow-key navigation and Space activation, skip disabled options and show visible focus around the entire card.

Keep selection marks and unchecked boundaries readable, with at least 3:1 boundary contrast. A disabled or read-only card must not offer hover or press transforms as if editable.

Empty and arriving option collections, long labels/descriptions/notes and independent groups must remain usable without shared radio names or document overflow.

onChange is a synchronous selected-ID notification. The host owns validation, persistence and any downstream assistant behavior.

## Motion

Enter the fieldset once with opacity and an 8px rise over 320ms. Reveal a newly selected check with opacity and scale from 0.7 over 160ms; keep 150ms card press feedback. Subscribe to live prefers-reduced-motion changes. Stop and settle owned card/check entrances immediately and remove press transforms.

## Integration

Supply options with unique stable IDs. Use defaultValue for local selection, or value with onChange for host acknowledgement. Native radios own keyboard navigation and skip disabled options. The callback is synchronous; persist or apply the setting in the host.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.

## Demo framing

The quiet demo stage fills its viewport with a 560px minimum. Reserve 920px for the published preview so the complete three-card phone stack fits at 320px and 390px, with balanced outer space. The named component still fills its host container naturally.

Keep read-only values legible. Dim unavailable options, while locking controlled groups without a writer through native disabled inputs and a quiet cursor.
