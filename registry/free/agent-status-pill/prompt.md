Build a compact status pill for AI agents in React + Tailwind CSS v4 + `motion/react`. It sits in a run header or at the end of a list row and answers one question at a glance: do I need to do anything? Five states (idle, running, needs you, failed, done), a live clock, a width that springs between states, and a click that opens the agent's recent activity with the one action the state is asking for.

**Anatomy**
- A wrapper `span` (relative, inline-flex) holding the pill `button`, a screen-reader `role="status"`, and the activity panel.
- The pill: `[dot] Label | 6:12`. A status dot, a Geist 500 label (tracking −0.005em), a 1px hairline separator, then the clock in Geist Mono with tabular numerals.
- Sizes: `sm` 24px tall, 9px padding, 6px gap, 12px label, 11px clock, 6px dot, 9px separator; `md` 30px tall, 12px padding, 7px gap, 13px label, 12px clock, 7px dot, 11px separator. Fully rounded. A `::before` extends the hit area to 44px tall without growing the pill.
- Width: the content sits in a `w-max` span measured with a ResizeObserver; the button animates `width` to that number (spring stiffness 500, damping 40) inside an overflow-hidden clip, so "Needs you | 1:14" becomes "Running | 6:12" without the text ever scaling.

**States (the dot carries the meaning)**
- Idle: hollow 1.5px ring, `#71717a`, no clock. Running: solid ink dot with a ping ring (scale 1 → 2.9, opacity 0.55 → 0, 1.6s). Needs you: `#f5a524` dot with a slower 2.4s ping. Failed: solid `#f2555a`. Done: solid `#3fcf8e`.
- The ping is the only ambient motion. It pauses offscreen (IntersectionObserver via `useInView`) and is removed under reduced motion.
- Only the two states that ask something of the user tint the pill: label `color-mix(in oklab, tone 74%, ink)` (52% on light), surface the tone at 9% over the base surface, ring the tone at 34%. Every other state is monochrome.
- Clock: `since` and `until` epoch props. Running counts run time, Needs you counts time spent waiting, Failed and Done freeze at `until`. Format `m:ss`, then `h:mm:ss`; wrapped in `<time dateTime="PT…">`. It ticks once a second only while open-ended and on screen, and renders nothing until mount so server and client markup match.

**Colour (monochrome first)**
- Dark: ink `#f4f4f5`, muted `#a1a1aa`, faint `#71717a`, pill surface white 4.5% with a white 10% inset ring and a white 6% top highlight; hover adds white 8%. Panel `#111113`, ring white 9%, command well `#09090b`.
- Light: ink `#18181b`, muted `#52525b`, surface ink 4%, ring ink 12%, panel `#ffffff`, well `#f4f4f5`.
- Everything is exposed as `--asp-*` custom properties on the wrapper; `tones` overrides a state's colour.

**Activity panel**
- Opens on hover once the pointer has rested for 380ms (each pointer move restarts the wait, so a cursor crossing the pill on its way elsewhere never opens it), closes 140ms after the pointer leaves unless pinned; a click pins it, a second click closes it. An invisible 10px bridge over the gap keeps it open on the way from pill to panel. Any press outside closes a pinned panel; Esc closes and returns focus to the pill.
- Positioned absolutely below (or above with `side="top"`), aligned to the pill's end by default, `min(19rem, 100vw − 2rem)` wide, 12px radius, 14px padding, inset hairline plus a deep soft shadow. No portal.
- Contents: dot + heading (13px 500) with the clock at the right, an optional summary (12.5px, leading 1.5, muted), an optional command in a mono well prefixed with a faint `$`, an ordered list of recent steps (mono 10.5px relative time in a 2.25rem column, 12.5px text; the live step in full ink), and a footer of actions split by a hairline: one filled ink button for the primary action, outlined buttons for the rest, 32px tall, 8px radius. Choosing an action closes the panel.

**Motion**
- Label swaps cross-fade with `AnimatePresence mode="popLayout"`: in from y 5px and a 3px blur over 240ms ease-out `[0.22, 1, 0.36, 1]`, out to y −5px over 160ms ease-in. The clock enters and leaves the same way.
- The dot's fill and ring animate in 240ms. Press moves the pill 1px down in 100ms; hover lifts the surface in 150ms.
- Panel: in from y −6px, scale 0.98 and a 4px blur over 220ms, origin at the pill's corner; out in 140ms. Activity rows rise 4px, 45ms apart.
- Reduced motion: no ping, no blur or offset, width sets instantly, 150ms opacity fades.

**Accessibility**
- The pill is a `button` with `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`. The panel is a non-modal `role="dialog"` labelled "{agent}: {heading}", placed right after the pill so Tab walks into it.
- A visually hidden `role="status"` announces "Fixer: Needs you" on state changes and never the ticking clock.
- Focus is a 2px ink outline offset 2px, keyboard only. Mouse-only hover has a click equivalent; touch opens on tap.

**Demo (true black stage)**
- A 640px card (`#0b0b0c`, 18px radius, hairline): a header with a grey "Fx" monogram tile, a mono breadcrumb "northwind / agents / fixer", the title "Migrate billing webhooks to v2" and the featured `md` pill, waiting for 1:14 on a 6:12 run. Its panel asks "Approve a migration?" with `pnpm prisma migrate deploy`, Deny and Approve. Approve resumes the run clock at 6:12.
- Below, "Other runs" with four `sm` rows: lint-sweeper running, docs-writer done in 3:07, test-doctor failed, dep-bot idle with Run now. Each row raises its z-index while its panel is open; the last two open upward.
- Entrance once at 30% in view: card rises 12px out of an 8px blur (0.5s), header at 80ms, label at 160ms, rows from 220ms 60ms apart.

**Don't**
- No colour on running, no gradient or glow around the pill, no pulsing label, no spinner next to the dot. No width jump between states, no scaled text from a layout animation. No percentage progress. Don't announce the clock. Don't add pills that only assert a quality: every state here changes what the user does next.
