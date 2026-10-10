Build one toast that follows one async job, in React 19 + Tailwind CSS v4 + `motion/react`. It is a single notification, not a stack: it starts on loading, morphs in place to success or error, and on success counts its window down, with Undo and a ring around the button when Undo is on. It should feel like a receipt for something that just happened, not a chat bubble and not a marketing banner.

**Layout**
- The card is at most 392px wide (it fills a narrower container), radius 14px, padding 14px 16px 16px, one row: an 18px status glyph, a text column that takes the remaining width, then the Undo button and a 28px dismiss button, with 4px between the two actions.
- The toast fills the nearest positioned parent (`absolute`, the default) or the viewport (`fixed`). Its layer is a `@container`, so the insets follow the container: 16px from the edges, and 24px once the container is 448px wide or more. Positions: bottom-right (aligned right, bottom edge), bottom-center (centred on the x axis, bottom edge), top-right (aligned right, top edge). A narrow container gets a card that fills its width, with no viewport breakpoints anywhere.
- The Undo button is a fixed 76 × 32px pill. Its countdown ring is a rounded rectangle 84.5 × 40.5 with radius 20.25 drawn 5px outside the button, so its size never changes when the label changes.
- A 2px hairline runs along the card's lower edge, clipped by the card's rounded corners.

**Typography**
- Title: 14px / 20px, weight 500, tracking -0.01em, ink.
- Description: 13px / 1.45, weight 400, muted, `tabular-nums`. When it carries the window it reads "5 s to undo" with non-breaking spaces, so the group never wraps apart.
- Dismiss and Undo labels: 13px, weight 500, tracking -0.01em.
- No all-caps labels, no mono in the toast itself.

**Colour (dark is the default; monochrome first)**
- Card: #17171a. Hairline ring: inset 0 0 0 1px rgba(255,255,255,0.09). Top highlight: inset 0 1px 0 rgba(255,255,255,0.04). Shadow: 0 28px 56px -18px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.4).
- Ink #f4f4f5 for title, Undo and Retry labels and the loading sweep. Muted #a1a1aa for description, spinner and dismiss glyph.
- Undo fill rgba(255,255,255,0.06), hover rgba(255,255,255,0.12), with the same 1px inset ring as the card.
- Semantic only: success #6fd08c (check and settled hairline), error #ff7a6b (cross and settled hairline). Nothing else is coloured.
- Light theme: card #ffffff, hairline rgba(24,24,27,0.09), ink #18181b, muted #52525b, success #3f8a50, error #c9553d, undo fill rgba(24,24,27,0.05), hover rgba(24,24,27,0.09).

**The four states**
1. Loading: an 18px ring with a 90-degree arc turning at 1.2s per turn (static under reduced motion). The hairline carries a 40%-wide soft sweep (ink fading in and out at both ends) that runs left to right every 1.3s, linear, forever. The copy reads "Archiving 12 threads…" with "Moving them out of your inbox" beneath. No Undo, no countdown.
2. Success: the spinner cross-fades into a 1.7px check that draws its stroke over 340ms (delayed 80ms). The hairline lands as a success-coloured bar scaling from its left edge over 500ms and fades out 1.1s later. The description carries the window: "Moved to Archive · 5 s to undo". With Undo on, Undo appears with a 220ms scale from 0.92 and opacity, and the ring is full at the start and drains around the button over the whole window. With Undo off there is no button and no ring, but the toast still leaves when the same window ends.
3. Error: the glyph becomes a circle with a cross. The hairline lands as an error-coloured bar and stays. The copy names the state the world is in: "Nothing was archived. Your inbox is unchanged." With `onRetry` set, a quiet text button ("Try again") takes the Undo slot: no fill, muted until hover, a 44px hit area. Pressing it runs the job again and the toast returns to loading. Without `onRetry` there is no Retry. An error has no timer: it stays until it is retried or dismissed.
4. Undone: after Undo is pressed the glyph becomes a return arrow, the title reads "Restored 12 threads", the description reads "Put back where it was", the ring and the button disappear, and the toast leaves 1.6s later.

**Motion**
- Entrance: the card rises 14px from opacity 0 with a 6px blur that clears, 420ms on the ease-out curve `[0.22, 1, 0.36, 1]`.
- Status changes: the copy and the glyph cross-fade with a 6px rise, a 3px blur and 260ms (the outgoing copy takes 160ms, ease-in). Never a hard cut.
- Countdown: a motion value runs linearly from 1 to 0 over the success window, whether or not Undo is on. Hovering the card, focusing inside it or hiding the tab pauses it where it stands; leaving resumes from that point, so a hover never resets the window. When it empties the toast leaves, and `onDismiss` runs.
- Swipe: horizontal drag with rubber-band resistance (0.35). A drag past 90px, or a flick faster than 500px/s, dismisses it in that direction (it flies 420px out and fades). Anything shorter springs back to 0 on a stiff spring (stiffness 420, damping 36). Touch keeps vertical scroll (`touch-action: pan-y`).
- Exit: a dismissed toast drops 8px and fades over 220ms on the ease-in curve.
- Reduced motion: the rise, the blur, the swipe fly and the spinner and sweep stop; the loading hairline becomes a faint full-width track, not a segment. Opacity still changes over 150ms. The countdown still drains, because it reports time, not decoration.

**Behaviour and accessibility**
- Each run of the job gets an id; a result that arrives after a newer run has started is ignored, so a re-run or a Retry never lands on a stale state. A job that throws synchronously settles as an error.
- Announce politely: a visually hidden `role="status"` with `aria-live="polite"` sits in the always-mounted layer, empty at first, and receives "title. description" on the next frame after each status change, so the region exists before the words arrive. The countdown never announces.
- Undo, Retry and dismiss are real buttons with keyboard focus rings (2px, current colour). Undo's ring sits 9px out, beyond the countdown ring, so the ring never hides how much of the window is left. Dismiss has `aria-label="Dismiss"`. Esc inside the toast dismisses it.
- Touch targets: the visible Undo pill is 32px tall and its hit area reaches 44px. The visible dismiss circle is 28px and its hit area reaches 44px. Retry's hit area also reaches 44px.
- The card is a `div` with `role="group"` and `aria-labelledby` pointing at its title (not a landmark, since the live region already announces). Hover pauses are pointer events; focus pauses come from `focus` and `blur`, so keyboard users can read the copy and reach Undo at their own pace.
- Pressing Undo moves focus to the Dismiss button, so focus is never dropped to the page as Undo unmounts.
- Hover and focus are cleared when the toast leaves, and read live from the DOM when the next one opens: a card that unmounts under the pointer never fires pointerleave, and a stale flag would freeze the next countdown.

**Don't**
- Don't stack several toasts or fan them out: that is `toast-stack`. This is one job, one toast.
- Don't use a spinner that never resolves, a progress bar that fills with a percentage nobody computed, confetti, a green tick in a rounded square, or a coloured card per state.
- Don't put the countdown in the copy as a ticking number; the ring is the countdown. The description states the window once.
- Don't restart the countdown on hover, or let it run while the pointer is on the toast.
- Don't add emoji, sparkles, glow, glassmorphism, gradient text or a bouncing entrance.
