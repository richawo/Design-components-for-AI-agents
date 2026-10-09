Build a slim announcement strip that sits above a site header, in React + Tailwind CSS v4 + `motion/react`. Messages rotate with a vertical text roll, a small badge shimmers once as each message arrives, and dismissing collapses the strip's height so everything below glides up instead of jumping.

**Layout**
- A `<section>` with `overflow-hidden`, background `#0b0b0c`, bottom border `white/8%`. Inner row is the `@container`, `max-w-[1280px] mx-auto`.
- Height 40px (44px under 672px of container width so the dismiss button is a full touch target).
- ≥672px: grid `96px 1fr 96px` with `px-6` (aligned with the header's gutter). Left: pager. Centre: the message, centred. Right: dismiss.
- <672px: grid `1fr auto`, `pl-4 pr-1`; the message is left-aligned and the pager is hidden.
- Message row: badge, text (truncates), link with arrow, 10px gaps. Each message may carry a `short` version used under 896px.

**Typography**
- Text 13px, tracking −0.005em, `white/80`, one line, ellipsis.
- Link 13px, weight 500, white; under 672px the label becomes screen-reader-only and the whole row is the link (stretched `::after`).
- Badge: `font-mono` 10px, uppercase, tracking 0.08em, 20px tall pill.

**Colour**
- Strip `#0b0b0c` on a `#000` page. Text `white/80`, link white, arrow `white/60` → white on hover.
- Badge: text `#ffa375`, fill `#ff8a4c` at 12%, inset ring `rgba(255,138,76,.28)`. Shimmer: a 100° linear gradient (`transparent 25% → rgba(255,220,200,.55) 50% → transparent 75%`) with `mix-blend-mode: plus-lighter`.
- Pager segments: 16×3px, track `white/16%` (30% on hover), fill `white/90` (`white/55` while paused).
- Dismiss: `white/45` → white with a `white/6%` surface on hover.

**Motion**
- Roll: the message is keyed by id inside `AnimatePresence`; it enters from y 100% (or −100% when going back) with blur 4px → 0 and opacity, and the outgoing one leaves the opposite way. 500ms `cubic-bezier(0.22,1,0.36,1)`.
- Shimmer: one sweep, x −110% → 110% over 900ms `cubic-bezier(0.65,0,0.35,1)`, 350ms after the badge mounts. Never loops.
- Timer: a rAF loop accumulates elapsed time (default 5200ms per message) and writes it to a motion value that drives the active segment's `scaleX`. It pauses on hover, on focus within, when the strip is offscreen (IntersectionObserver) and in hidden tabs.
- Arrow nudges 2px right on link hover (150ms).
- Dismiss: content fades in 140ms, then height animates to 0 over 320ms `cubic-bezier(0.65,0,0.35,1)` (60ms delay); content below follows the shrinking height. Showing again animates height from 0 to auto in 360ms.
- Press: dismiss scales to 0.94. Reduced motion: no autoplay (segments become a manual pager), opacity-only swaps, no shimmer, instant collapse.

**Accessibility**
- `section aria-label="Announcements" aria-roledescription="carousel"`; each message `aria-roledescription="slide"` with "n of N".
- The message region is `aria-live="off"` while rotating and `polite` when paused, so screen readers are not interrupted every five seconds.
- Pager buttons say "Announcement 2 of 3" with `aria-current`. Dismiss is an icon button labelled "Dismiss announcements".
- Visibility is controllable (`open` + `onDismiss(id)`); `storageKey` optionally remembers dismissal in localStorage inside try/catch.

**Don't**
- No full-bleed brand gradient, no marquee scroll, no emoji, no confetti badge.
- Don't remove the strip with `display: none` — the page below must glide, not jump.
- Don't loop the shimmer or pulse the badge.
