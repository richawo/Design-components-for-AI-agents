Build a slim, monochrome announcement strip that sits above a site header, in React + Tailwind CSS v4 + `motion/react`. It unfolds on first view, messages rotate with a vertical text roll, a small badge shimmers once as each message arrives, and dismissing collapses the strip's height so everything below glides up instead of jumping.

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
- Monochrome: black, white and greys. Keep the strip, page and default badge ink in one `COLOR` token object. The only colour hook is an optional `accent` prop for the badge (brand colour); without it the badge is white.
- Strip `#0b0b0c` on a `#000` page. Text `white/80`, link white, arrow `white/60` → white on hover.
- Badge: text = ink (`#ffffff` or `accent`), fill = ink at 10% (`color-mix(in srgb, ink 10%, transparent)`), inset 1px ring = ink at 22%. Shimmer: a 100° linear gradient (`transparent 25% → rgba(255,255,255,.5) 50% → transparent 75%`) with `mix-blend-mode: plus-lighter`.
- Pager segments: 16×3px, track `white/16%` (30% on hover), fill `white/90` (`white/55` while paused).
- Dismiss: `white/45` → white with a `white/6%` surface on hover.

**Motion**
- First view (ease `cubic-bezier(0.22,1,0.36,1)`): the strip's height unfolds 0 → auto (360ms) and clips its contents as they arrive. The pager's segment tracks draw from the left (`scaleX` 0 → 1, 400ms) 40ms apart from 140ms; the first message rolls up from y 100% with a 4px blur at 180ms; the badge shimmer runs 350ms after that; the dismiss button lands last at 360ms (opacity, y 8px → 0, blur 6px → 0, 450ms). The rotation timer starts at 700ms, so the first segment only fills once everything has landed. The strip is its own component mounted per showing, so bringing it back replays the entrance.
- Roll: the message is keyed by id inside `AnimatePresence`; it enters from y 100% (or −100% when going back) with blur 4px → 0 and opacity, and the outgoing one leaves the opposite way. 500ms `cubic-bezier(0.22,1,0.36,1)`.
- Shimmer: one sweep, x −110% → 110% over 900ms `cubic-bezier(0.65,0,0.35,1)`, 350ms after the badge mounts. Never loops.
- Timer (`useRotationTimer`): a rAF loop accumulates elapsed time (steps capped at 100ms) (default 5200ms per message) and writes it to a motion value that drives the active segment's `scaleX`, with no React render per frame. It pauses on hover, on focus within, when the strip is offscreen (IntersectionObserver) and in hidden tabs.
- Arrow nudges 2px right on link hover (150ms).
- Dismiss: content fades in 140ms, then height animates to 0 over 320ms `cubic-bezier(0.65,0,0.35,1)` (60ms delay); content below follows the shrinking height. Showing again animates height from 0 to auto in 360ms.
- Press: dismiss scales to 0.94. Reduced motion: no autoplay (segments become a manual pager), 150ms opacity-only entrance and swaps, no shimmer, instant unfold and collapse.

**Accessibility**
- `section aria-label="Announcements" aria-roledescription="carousel"`; each message `aria-roledescription="slide"` with "n of N".
- The message region is `aria-live="off"` while rotating and `polite` when paused, so screen readers are not interrupted every five seconds.
- Pager buttons say "Announcement 2 of 3" with `aria-current`. Dismiss is an icon button labelled "Dismiss announcements".
- Visibility is controllable (`open` + `onDismiss(id)`); `storageKey` optionally remembers dismissal in localStorage inside try/catch.

**Demo**
- Under the strip: a wordmark-only header row (Outpost mark + name, hairline below) and the release note the first message links to: a mono eyebrow ("Release notes · 3.0 · 9 Oct 2026"), the headline "Incidents now draft their own postmortems." (`clamp(2rem, 1.4rem + 2.6vw, 3.5rem)`, tracking −0.045em), a lead, and three numbered hairline rows (mono index, 15px title, 14px body). Everything staggers in 60ms apart from 300ms, after the strip. No skeleton bars, no fake nav. After dismissal a quiet mono "Bring the strip back" pill rises in.

**Don't**
- No full-bleed brand gradient, no orange or tinted badge by default, no marquee scroll, no emoji, no confetti badge.
- Don't remove the strip with `display: none` — the page below must glide, not jump.
- Don't loop the shimmer or pulse the badge.
