Build a slide-over cart drawer in React + Tailwind CSS (v4) with `motion/react` and `lucide-react`, for an independent goods shop ("Fieldwork Supply"). It has drawn product thumbnails, quantity steppers, remove-with-undo, a free-shipping bar that animates as the subtotal changes, a single upsell and a confident checkout button. On phones it becomes a full-height bottom sheet.

**Layout**
- Desktop (640px and up): a 440px panel pinned to the right edge at full height over a scrim (`#0d1a12` at 45%). Phones: a bottom sheet from `top: 12px` to the bottom edge, with a 22px top radius and a 40×4px drag handle.
- Panel colour `#f7f3ea`, ink `#14261c` (deep forest). Side padding 20px mobile, 28px desktop.
- Header: "Your bag" in display at 28px, weight 700, tracking −0.035em, leading 1. A mono line under it: "4 items · ships from Hebden Bridge" (11px, uppercase, 0.14em tracking, 55% ink). A 44px round close button on the right.
- Free-shipping card: `#ece5d4`, 14px radius, padding 14px 16px. It reads "You’re £9.00 away from free shipping." (amount bold, tabular), or "Free shipping unlocked. Nicely done." with a green check disc. Below sits an 8px track (10% ink) with a fill (ink, turning `#2f6b3a` once unlocked) and a 28px cream disc with a truck icon riding the end of the fill. Mono end labels: "£0.00" and "Free over £75.00".
- Items scroll inside a flex-1 region, divided by 1px rules at 10% ink. Each row: a 72×84px drawn thumbnail (10px radius, `#e7dfcc`), then the name (15px semibold), the variant (13px, 60% ink) and the line price (15px, tabular) right-aligned. Along the bottom, a pill stepper (white, 14% ink inset ring, − qty +) and an underlined "Remove".
- Removing swaps the row for a dark undo bar (`#14261c`, 12px radius): "Removed **Enamel camp mug**" and a lime (`#d7e3a4`) Undo pill. A 2px lime line along the bottom drains over 5s, then the row collapses. Hover or focus pauses the countdown.
- Upsell: a dashed-border card with a small thumbnail, a "Pairs well" mono eyebrow in green, the name, a one-line pitch ("Lives in the notebook’s spine.") and a "+ £12.00" pill. Adding it pushes the subtotal over the threshold, which shows the bar completing.
- Footer, ruled off: Subtotal and Shipping (amount, or "Free" in green) in a `dl`, then a 56px full-width ink pill: a lock icon and "Checkout" on the left, the total in a lime capsule on the right. Under it, a 12px reassurance line about VAT and free returns.
- The trigger is a 44px ink pill: bag icon, "Bag", and the count in a lime circle.

**Thumbnails**
- Inline SVG on a 76×84 viewBox, each colourable: a waxed notebook with a spine shadow, an elastic band and a label; an enamel mug with a dark rim, a handle and a small stamped mark; a sock with a cream cuff and heel; a brass pencil. A white-to-black horizontal sheen gradient (opacity 0.18 → 0 → 0.16) gives believable shading. Gradient ids come from `useId()`.

**Motion**
- Panel: a spring (stiffness 340, damping 36) in from the right on desktop, from the bottom on phones. The scrim fades over 300ms.
- The shipping fill and truck use a spring (stiffness 120, damping 20). The truck wiggles once when free shipping unlocks.
- Prices roll vertically (y 100% → 0, 280ms) when they change. Rows grow and collapse in height over 300ms with `[0.2, 0.8, 0.2, 1]`.
- Sheet drag: only from the handle (`useDragControls`). Dismiss past 140px or 700px/s, otherwise it springs back.
- With reduced motion, every transition becomes an opacity fade and dragging is off.

**Accessibility**
- `role="dialog"`, `aria-modal`, labelled by the heading and described by the shipping status. Focus moves to the dialog on open, Tab is trapped inside, Esc and the scrim close it, and focus returns to the trigger.
- Steppers are labelled groups. The buttons read "Decrease quantity of Waxed field notebook", and at quantity 1 the minus becomes "Remove …". A polite live region announces quantity changes, removals and restores.
- The shipping bar is a `progressbar` with min, max and now values. Touch targets are 44px on phones.

**Don't**
- No product photos or grey placeholder boxes. Draw the goods.
- No toast-only undo hidden somewhere else. Undo lives where the item was.
- Don't use a gradient checkout button or a "Hurry, only 2 left!" pressure line.
