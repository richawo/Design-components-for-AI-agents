Build a ranked channel breakdown in React + Tailwind CSS v4 with `motion/react` and `lucide-react`. Dark and monochrome: a 100% share strip whose segments grow in rank order, then ranked rows whose figures count up and whose bars fill once they land. Switching period re-sorts the rows on a spring, so a channel overtaking another is something you watch happen.

**Layout**
- Root `<section>` with `@container`; one card: surface, 1px line, 14px radius, inset highlight + deep shadow, padding 16px (24px from `@md`).
- Header: 14px muted title (“Revenue by channel”) over the period total in `font-display` at `clamp(1.6rem, 1.2rem + 2cqi, 2.2rem)` (600, −0.04em); a segmented period switch (7D / 30D / 90D) on the right; a 13px faint caption under it (“Last 7 days · a café wholesale order landed Tuesday”).
- Share strip 20px below: 10px tall, segments separated by 3px gaps, 3px radius, each `flex-grow` = its share.
- Rows (a `<ul>`), 12px vertical padding, hover lifts the row to the raised surface: a mono 11px rank (“01”), the channel name (14px medium, truncates), an optional delta (“↗ 22%”, 12px, hidden below `@sm`), the amount (14px medium) and the share (12px faint, 3.4ch wide, right-aligned). Under it, indented to the name, a 4px track with the bar scaled to share ÷ the leader’s share.
- Data: `periods: { key, label, caption?, channels: { name, value, previous? }[] }[]`. Channels are sorted by value; shares come from the period total.

**Colour (monochrome first)**
- Dark (default): surface `#111113`, raised `#17171a`, line `#232327`, track `#1c1c20`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#8a8a93`. Light: surface `#ffffff`, raised `#f4f4f5`, line `#e4e4e7`, track `#efeff1`, ink `#18181b`, muted `#52525b`, faint `#71717a`.
- Rank is lightness: the leader wears the one `accent` prop (default: the theme’s ink); ranks 2–6 are the ink at 62%, 44%, 30%, 20%, 14% (`color-mix`). Segment and bar of a channel always share its colour.
- Deltas are green `#4ade80` / red `#f87171` (light `#60606a` / `#b91c1c`). Nothing else has hue.
- Hovering (or tapping) a row lights its segment and dims the others to 35%.

**Motion** (ease-out `[0.22, 1, 0.36, 1]`; timings in one MOTION object)
- Once at 25% in view. Card rises 12px out of an 8px blur (0.5s); title, total (counts from 0 over 0.75s with a 6px blur that clears), switch and caption follow 60ms apart.
- Strip segments grow from zero in rank order from 0.22s, 50ms apart, 0.5s each. Rows land from 0.16s, 50ms apart; inside each, the amount, share and delta count up; the bar fills 0.22s after its row lands (0.55s).
- Period switch: rows re-sort with a `layout="position"` spring (500/40); rank numbers roll (old one out upward, new one in from below); amounts, shares and bars tween from their current values with no stagger; segments retarget together and slide to their new order; the caption cross-fades.
- Reduced motion: 150ms fades, figures and bars set instantly, no layout springs.

**Accessibility**
- The period switch is a `radiogroup` with roving tabindex and arrow keys. Counting figures render an sr-only final value; delta arrows carry sr-only “up”/“down”. The strip is decorative (`aria-hidden`): every number it shows is in the rows. 2px focus-visible outlines in ink.

**Don’t**
- No donut, no rainbow of channel colours, no glow. No re-staggering rows on every switch: rows move, they don’t re-enter. No proportional figures.
