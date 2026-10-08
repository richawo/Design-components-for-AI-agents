Build a stacked toast system in React + Tailwind CSS (v4) with `motion/react` and `lucide-react`. One file exports a `useToasts()` hook, a `toast` object usable outside React, and a `<Toaster>`. Toasts stack like a hand of cards and fan out on hover. The demo is a dark editorial CMS ("Quire") with the toaster living inside an editor mock-up.

**Store and API**
- A tiny module-level store read with `useSyncExternalStore`, so no provider is needed. Newest first, capped at 5.
- `toast.success / error / info(title, { description, action: { label, onClick }, duration })` return an id. `toast.promise(p, { loading, success, error })` shows a loading toast and updates the same toast in place when the promise settles. `dismiss(id?)`.
- `useToasts()` returns `{ toasts, toast, success, error, info, promise, dismiss }`.
- Default duration 5000ms (errors 8000ms). Loading toasts never time out. Every update bumps a `version`, which restarts the timer.

**Toaster layout**
- `strategy`: "fixed" (viewport) or "absolute" (nearest positioned parent). `position`: bottom-right, bottom-left or bottom-center from 640px up. Below that it spans the bottom edge with 16px insets.
- Width 360px. Each toast is absolutely positioned at the bottom of an `ol` whose height animates to fit the stack.
- Collapsed: toast *i* sits at `y = −i × 14px` with `scale = 1 − i × 0.05` and transform-origin at top centre, so a 14px sliver of the cards behind peeks above the front one. Only 3 are visible. Cards behind borrow the front card's height and fade their content to 0, so nothing peeks out below.
- Expanded (on hover, focus-within, or a tap on touch): every toast moves to `y = −(sum of the heights in front + 10px gaps)` at scale 1. Heights are measured with ResizeObserver.

**Toast design**
- Card `#1c1c1f`, 14px radius, inset 1px ring at 8% white, 6% top highlight, and a deep shadow `0 16px 40px −12px rgba(0,0,0,.7)`.
- Padding 14px 40px 14px 16px. An 18px icon disc: success `#3ddc97` with a check, error `#ff6b5e` with "!", info `#8ab8ff` with an "i". Loading is a spinning `LoaderCircle`, and the icon pops (scale 0.4 → 1) when the type changes.
- Title 14px, weight 500, `#f4f4f5`. Description 13px `#a1a1aa`. The optional action is a 32px light button (`#f4f4f5` on dark). A 32px close button sits in the top-right corner.
- A 1px timer line at 25% white runs along the bottom edge (CSS keyframes `tm-toast-stack-timer` scaling X from 1 to 0) and pauses with `animation-play-state` whenever the timer pauses.

**Motion**
- Enter from `y: 56`, opacity 0. Layout moves use a spring (stiffness 380, damping 34, mass 0.9). Exit to scale 0.94 and opacity 0 over 200ms.
- Swipe: `drag="x"` with elastic 0.85, and opacity falls to 0 at ±220px. Release past 90px or 600px/s and the toast flies out in that direction, then dismisses. Otherwise it springs home.
- Timers pause on hover, focus, drag and hidden tabs, and resume with the remaining time.
- With reduced motion, no drag, no springs, and opacity-only enter and exit.

**Demo**
- Background `#0b0b0c`, max width 76rem. Left (5 of 12 columns): a mono kicker, then the display headline "Toasts that *know their place.*" with the second clause in the same font at 40% white (two tones, no italic), a 16px intro, and a ruled list of five trigger rows (mono index, coloured dot, label, sample title, a "Fire" pill). Right (7 columns): an editor mock-up (`#131315`, 18px radius) showing a document title, two initials avatars, a live toast count, and an article ("Notes from a slow kitchen") in serif. The toaster renders inside it with `strategy="absolute"`.
- Three toasts are seeded on mount, 320ms apart. Copy should sound like a real product: "Draft saved — 1,284 words, all of them yours.", "Couldn’t reach the printer" with "Retry now", "Moved 3 drafts to the bin" with "Undo", and a promise that ends "Published. Go and make a coffee."

**Accessibility**
- A labelled `section` region ("Notifications (Alt+T)"). Alt+T focuses the newest toast. Each toast is focusable, with `role="status"` (errors use `role="alert"`) and a full aria-label. Esc, Delete or Backspace dismisses the focused toast.
- Close and action buttons are real buttons with focus rings. Swiping always has a button alternative.

**Don't**
- No coloured full-bleed toasts, no glassmorphism blur, no emoji icons.
- Don't stack toasts as a plain vertical list, and never let a timer run out while someone is reading.

**Press feel**
- Every button and link presses: 0.97 for buttons and links, 0.99 for full-width rows, in 150ms, springing back on release. Colour, background and transform share one transition so nothing snaps. Hover changes are a single step, and focus rings appear instantly.
