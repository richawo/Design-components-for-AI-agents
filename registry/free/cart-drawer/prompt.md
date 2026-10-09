Build a slide-over cart drawer in React + Tailwind CSS v4 with `motion/react` and `lucide-react`, for an independent goods shop. Drawn product thumbnails, quantity steppers, remove-with-undo, a free-shipping meter, one upsell and a confident checkout button. On phones it becomes a bottom sheet. Monochrome: the only colour besides the products' own is one accent on the amount you're about to pay. Every open is choreographed.

**Tokens** (one `PALETTE` object with `dark` and `light`, written to CSS variables; one `T` timeline object; named springs and constants)
- Dark: panel `#0b0b0c`, raised (undo bar) `#1a1a1d`, thumbnail tile `#161618`, ink `#f4f4f5`, text on ink `#0b0b0c`, scrim black at 60% with a 2px blur, a 1px ink/8% inner edge on the left.
- Light: panel `#ffffff`, raised and tile `#f1f1f2`, ink `#111113`, scrim ink at 32%.
- `accent` prop, default `#d7e3a4`, used once: the total capsule inside the checkout button (near-black text). The trigger badge, meter fill, "Free", "Pairs well" and the Undo pill are ink.
- Springs: panel 340/36 (exit stiffer, 420), meter 120/20. Sheet dismiss past 140px or 700px/s. Max quantity 9.

**Layout**
- Desktop (640px+): a 440px panel pinned right, full height. Phones: a bottom sheet from `top: 12px`, 22px top radius, a 40×4px drag handle. Side padding 20px / 28px.
- Header: "Your bag" display 28px bold, tracking −0.035em; a mono line "4 items · ships from Hebden Bridge" (11px uppercase, 0.14em, ink/55); a 44px round close button.
- Free-shipping card (ink/4%, radius 14px): "You’re £9.00 away from free shipping." or, unlocked, an ink check disc and "Free shipping unlocked. Nicely done."; an 8px track (ink/10) with an ink fill and a 28px panel-coloured disc with a 1.5px ink ring and a truck riding the end of the fill; mono end labels.
- Items scroll in a flex-1 region with ink/10 rules. Each row: a 72×84 drawn thumbnail, name (15px semibold), variant (13px ink/60), line price (15px, tabular) right; a pill stepper and an underlined "Remove" along the bottom.
- Removing swaps the row for a raised undo bar ("Removed **Enamel camp mug**", an ink Undo pill) with a 2px ink/50 hairline draining over 5s; hover or focus pauses it; then the row collapses.
- Upsell: a dashed ink/20 card with a small thumbnail, "PAIRS WELL" (mono, ink/50), name, a one-line pitch and a "+ £12.00" pill. Adding it crosses the threshold, so the meter completes.
- Footer: Subtotal and Shipping in a `dl`, a 56px ink pill (lock + "Checkout" left, the accent total capsule right), then a 12px reassurance line.
- The trigger: a 44px ink pill, bag icon, "Bag" and the count in a panel-coloured circle.
- Demo stage: only the bar the trigger lives in, on `#08080a`. No storefront, nav or headline behind the drawer.

**Thumbnails**
- Inline SVG on a 76×84 viewBox, coloured by the product's own colour (depicted, so it stays): waxed notebook, enamel mug, sock, brass pencil, with a white-to-black sheen gradient whose id comes from `useId()`.

**Motion — every open** (seconds from the panel starting to move; ≈900ms)
- Panel springs in from the right (from the bottom on phones); scrim fades over 300ms.
- Blocks rise 12px out of an 8px blur (500ms, `[0.22, 1, 0.36, 1]`): header 0.12, shipping card 0.17, line items from 0.22 at 60ms apart, footer 0.3, upsell 0.42.
- The meter fills from zero at 0.36s, once its card has landed (one motion value drives the fill width and the truck). The subtotal and the checkout total count up from zero at 0.4s over 600ms, with a light velocity blur.
- After the panel settles, changes animate in place: quantities roll 14px in the direction of change; every price tweens (350ms) in a motion value — no React state per frame; added rows grow from height 0 and rise in; removed rows collapse; the truck wiggles once when free shipping unlocks.
- Sheet drag only from the handle (`useDragControls`).
- Reduced motion: one 150ms fade per block, figures set instantly, no drag.

**Accessibility**
- `role="dialog"`, `aria-modal`, labelled by the heading, described by the shipping status. Focus moves to the dialog on open, Tab is trapped, Esc and the scrim close it, focus returns to the trigger. Page scroll locks while a fixed drawer is open.
- Steppers are labelled groups ("Decrease quantity of …"; at quantity 1, "Remove the last …"). A polite live region announces quantity changes, removals and restores. The meter is a `progressbar`. 44px touch targets on phones; 2px ink focus rings.

**Don't**
- No fake storefront behind the drawer.
- No lime on badges, meters or labels: the accent is the checkout total only.
- No product photos or placeholder boxes; no toast-only undo; no gradient checkout button or "only 2 left" pressure.
- No per-frame React state for counting figures.
