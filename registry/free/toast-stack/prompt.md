Build a stacked toast system in React + Tailwind CSS v4 with `motion/react` and `lucide-react`. One file exports a `useToasts()` hook, a `toast` object usable outside React, and the component itself: `<Toaster>`. Toasts are dealt in like cards, stack like a hand, fan out on hover and leave when swiped. Greyscale and dark by default (a `theme` prop gives a light version); colour only for success and error. The demo is a minimal real trigger context, not a page: one draft card whose four actions each answer with a toast.

**Store and API**
- A tiny module-level store read with `useSyncExternalStore`, so no provider is needed. Newest first, capped at 5.
- `toast.success / error / info(title, { description, action: { label, onClick }, duration })` return an id. `toast.promise(p, { loading, success, error })` shows a loading toast and updates the same toast in place when the promise settles. `dismiss(id?)`.
- `useToasts()` returns `{ toasts, toast, success, error, info, promise, dismiss }`.
- Default duration 5000ms (errors 8000ms). Loading toasts never time out. Every update bumps a `version`, which refills the timer.

**Toaster layout**
- Props: `strategy` "fixed" (viewport) or "absolute" (nearest positioned parent); `position` bottom-right, bottom-left or bottom-center from 640px up (below that it spans the bottom edge with 16px insets); `accent`; `theme`; `label`; `hotkey`.
- Width 360px. Each toast is absolutely positioned at the bottom of an `ol` whose height animates to fit the stack (0.35s ease-out).
- Collapsed: toast *i* sits at `y = −i × 14px` with `scale = 1 − i × 0.05` and transform-origin at top centre, so a 14px sliver of the cards behind peeks above the front one. Only 3 are visible by default (a `visible` prop, 1 to 5). Cards behind borrow the front card's height and fade their content to 0, so nothing peeks out below.
- Expanded (hover, focus-within, or a tap on touch): every toast moves to `y = −(sum of the heights in front + 10px gaps)` at scale 1. Heights are measured with ResizeObserver.
- Sub-components `ToastItem`, `ToastGlyph`; hooks `useLifetime`, `useFocusHotkey`, `useTabHidden`.

**Toast design**
- Card 14px radius, inset 1px hairline, top highlight and a deep shadow. Padding 14px 40px 14px 16px.
- An 18px icon disc: success green with a check that draws, error red with "!", info a neutral grey disc with an "i", loading a spinning `LoaderCircle` (no disc).
- Title 14px/500 in ink, description 13px muted. The optional action is a 32px button in the accent (default: the theme's ink, so white on dark). A 32px close button sits in the top-right corner.
- A 1px countdown line at the bottom edge: `scaleX` bound to a `life` motion value.

**Colour (monochrome first; tokens in one PALETTE object as `--ts-*` CSS variables)**
- Dark (default): card `#1c1c1f`, hairline white/8%, top highlight white/6%, ink `#f4f4f5`, muted `#a1a1aa`, timer white/25%, info disc `#48484f` with `#f4f4f5`, success `#3ddc97` with `#06291a`, error `#ff6b5e` with `#3a0904`, shadow `0 16px 40px −12px rgba(0,0,0,.7), 0 2px 6px rgba(0,0,0,.35)`.
- Light: card `#ffffff`, hairline `rgba(24,24,27,.08)`, ink `#18181b`, muted `#52525b`, timer `rgba(24,24,27,.22)`, info disc `#e4e4e7` with `#3f3f46`, success `#16a34a` and error `#dc2626` with white, a soft grey shadow.
- One `accent` prop: the action button; text on it is black or white by luminance. Focus: 2px ink outline. No blue or yellow anywhere.

**Motion (ease-out `[0.22, 1, 0.36, 1]`, exits ease-in `[0.4, 0, 1, 1]`; timings in one MOTION object)**
- Arrive: the card rises from `y: 56`, opacity 0, on a spring (stiffness 380, damping 34, mass 0.9; no overshoot). Inside, 60ms apart: the icon disc pops (scale 0.4 → 1, spring 500/35), the title, the description and the action each rise 6px out of a 4px blur (0.34s). A success check draws (pathLength, 0.32s).
- The countdown line starts 0.35s after the card lands. `useLifetime` animates `life` 1 → 0 linearly over the remaining time and dismisses on complete; hover, focus, drag and hidden tabs stop the tween, and resuming continues from where it stopped. No setTimeout, no CSS keyframes.
- Promise settles: the disc colour cross-fades, the icon swaps (scale 0.4, 180ms) and the title cross-fades with a 6px offset and 3px blur.
- Exit: scale 0.94 and fade over 200ms ease-in.
- Swipe: `drag="x"` with elastic 0.85; opacity falls to 0 at ±220px. Release past 90px or 600px/s and the toast flies 420px out in that direction over 0.22s, then dismisses; otherwise it springs home (500/35).
- Reduced motion: no drag or springs; 150ms opacity fades; the countdown still runs.

**Demo (quiet `#0a0a0b` stage, centred)**
- A 460px draft card (`#111113`, 1px `#232327`, 16px radius): mono eyebrow "Quire · Draft 7", "The Autumn Issue" (display 22px/600, −0.03em), "1,284 words · edited 2 minutes ago" with the count ticking up from zero (a motion value, tabular numerals). Below a hairline, a 2×2 grid of 64px action cells (label + mono hint): Save draft (success: "Draft saved — 1,284 words, all of them yours."), Publish (promise: "Publishing to 4,120 readers…" → "Published. Go and make a coffee."), Send proofs (error "Couldn’t reach the printer" with "Retry now"), Move to bin (info "Moved 3 drafts to the bin" with "Undo").
- Card rises 12px out of an 8px blur (0.5s), then eyebrow, title and meta 60ms apart, the four cells from 0.24s, and a mono hint line at 0.5s. Four toasts are dealt in from 0.5s, 260ms apart, once the card has landed, and linger 12s so the stack can be played with (the Toaster's `duration` prop, default 5s; errors stay 1.6 times as long). A focused toast that is dismissed must release the stack's focus state, or the stack stays fanned out and paused. The real `<Toaster />` is fixed to the viewport, bottom-right.

**Accessibility**
- A labelled `section` region ("Notifications (Alt+T)"). Alt+T focuses the newest toast. Each toast is focusable, with `role="status"` (errors use `role="alert"`) and a full aria-label. Esc, Delete or Backspace dismisses the focused toast.
- Close and action buttons are real buttons with focus rings; swiping always has a button alternative. Buttons press to 0.97, demo cells to 0.98.

**Don't**
- No coloured full-bleed toasts, no glass blur, no emoji icons, no hue for "info". No marketing headline or fake editor around the demo. Don't stack toasts as a plain vertical list, and never let a timer run out while someone is reading.
