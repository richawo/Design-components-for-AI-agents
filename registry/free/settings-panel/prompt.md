Build an account settings page in React + Tailwind CSS (v4) with `motion/react` and `lucide-react`. Dark graphite, one acid-lime accent, and the feel of a tool made by people who actually use their own settings page: every control is custom but still native underneath, and a sticky bar tells you exactly how many things you've changed.

**Layout**
- Background `#0e0e10`, max width 1120px, padding 16 / 32 / 48px, top padding 40 → 80px.
- Header: mono breadcrumb ("FIELDNOTE / MIKA KORHONEN", 11px, 0.16em tracking), a big "Settings" heading, a one-line description at 16px (max 68ch, `text-pretty`).
- At ≥1024px: a 180px sticky section nav (top 40px) beside the content column, 56px gap. Each nav item is 36px tall; the active one sits on a `#1d1d21` chip with a 1px inset ring and a 2px lime tick, sliding between items with a shared `layoutId`. "Danger zone" is tinted coral.
- Below 1024px the nav becomes a sticky, horizontally scrolling tab strip (40px tabs, hidden scrollbar, 1px bottom border, 95% background with a light backdrop blur).
- Sections (Profile, Notifications, Appearance, Danger zone), 56px apart: a 22px display heading, a 14px muted hint, then a card (`#151518`, 1px `#232328`, 12px radius) of rows separated by `#222227` lines.
- Rows: 20px vertical padding. Field rows put label + hint on the left and the control on the right in a 2fr / 3fr grid at ≥768px, stacked below. Toggle rows keep the switch on the right at every width.
- Profile: 64px round avatar (initials in lime on `#26262c`, hover shows an upload icon over a dark scrim), "Upload new" and "Remove" buttons, drag-and-drop with a lime ring while dragging; display name; username with a fixed mono prefix "fieldnote.app/" inside the field; bio textarea with a live mono counter (turns lime near the limit); pronouns and time zone selects.
- Notifications: four switches (Mentions, Replies, Weekly digest, Product news) and a Delivery segmented control (Instantly / Hourly / Daily).
- Appearance: Theme (Light / Dark / System) and Density (Comfortable / Compact) segmented controls, Week starts on select. Segmented controls are full width on mobile, auto width from 640px.
- Danger zone: coral heading, a card on `#171213` with a `#4a2421` border. "Export everything" with an Export .zip button; "Delete account" opens (height animation) a confirm box: type your username, then "Delete forever" enables. Submitting replaces it with a calm status message.
- Unsaved changes bar: sticky at the bottom of the content column (bottom 16 / 24px), max 560px, `#1a1a1e` with a deep shadow. It reads "3 unsaved changes" with a pinging lime dot, then Discard and a lime "Save changes ⌘S" button. While saving: spinner + "Saving". After: "Changes saved" with a lime check, then it leaves.

**Typography**
- Heading: `font-display`, `clamp(2.5rem, 1.8rem + 3vw, 4.25rem)`, weight 600, tracking −0.045em, leading 0.95.
- Section headings 22px display, weight 600, tracking −0.03em. Labels 14px/500; hints 13px muted; inputs 14px; username and counters in `font-mono` 13px / 11px.

**Colour**
- Background `#0e0e10`; cards `#151518`; inputs `#111113` with `#2a2a30` borders (hover `#36363d`).
- Text `#f2f2f0`; muted `#9a9aa2`; faint `#6e6e76` (placeholders and prefixes only).
- Accent lime `#d4f25c` (hover `#dff77c`) with `#0e0e10` text on it: switches on, focus rings, active tick, Save. Segmented selection is a `#f2f2f0` pill with dark text.
- Danger coral `#ff8a7a` text, `#ff6b5a` destructive button, `#2a1513` / `#171213` surfaces.
- Set `color-scheme: dark` on the root so native select menus open dark.

**Motion**
- Switch knob moves with a `layout` spring (stiffness 700, damping 38). Segmented and nav pills share a `layoutId` spring (≈500 / 40).
- The save bar enters from y 96px with a spring (380 / 34) and exits the same way; its message cross-fades between "unsaved" and "saved".
- Danger confirm expands height over 0.35s, ease [0.2, 0.8, 0.2, 1].
- Reduced motion: fades only, no springs, no ping.

**Behaviour**
- Keep `saved` and `values` in state; the changed count is the number of keys that differ, so undoing a change by hand makes the bar disappear.
- ⌘S / Ctrl+S saves. `onSave(values)` may return a promise; the spinner shows until it resolves.
- Scroll-spy with an IntersectionObserver (rootMargin −15% / −70%) highlights the current section; clicking a nav item scrolls smoothly (instantly with reduced motion).

**Accessibility**
- Switches are `role="switch"` buttons with `aria-checked`, a 46×26 visual and a 44px hit area. Segmented controls are radiogroups with roving tabindex and arrow keys.
- Real `<label>`s, native `<select>`s, `aria-describedby` on the bio counter, `aria-live="polite"` on the save bar, `role="status"` on the deletion message.
- Lime 2px focus-visible outlines everywhere (coral in the danger zone).

**Don't**
- No glass, no gradients, no neon glow around the lime.
- No toasts that cover the form; the save bar is the only feedback.
- No browser-default selects or checkboxes, but don't replace native semantics with divs either.
- No "Are you sure?" modal for deletion; typed confirmation inline is the point.
