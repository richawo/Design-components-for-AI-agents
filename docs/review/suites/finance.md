# Finance suite shared language (from q35: finance-invoice-composer, finance-payment-run, finance-receivables-aging, finance-scenario-forecast)

Copy verbatim from those four sources (registry/pro/finance-*/); the PALETTE is byte-identical in all four.

- Tokens: one `PALETTE` object written to `--fin-*` vars. Keys: stage, surface, raised, sunken, line, lineStrong, ink, body, muted, faint, hover, positive #5fd394, caution #f2b35e, negative #ff7d6c, paper set (paper, paperInk, paperBody, paperMuted, paperLine, paperHover, paperPositive, paperNegative), shadow, raisedShadow, wellShadow, paperShadow. Light values tuned separately. `--fin-accent` and `--fin-accent-ink` (black/white by luminance); accent defaults to the theme ink. Accent control default #f4f4f5 (demo maps to undefined on light); swatches #f4f4f5, #8ea2ff, #c6f36d, #5eead4. Each component's control-kit prefix maps to --fin-* tokens.
- Chrome: `Toolbar` with a 36px raised icon tile, 12.5px breadcrumb, entity name 15px/600, a `StatusPill` (label crossfade, width spring); context/actions on the right; left cluster `min-w-[min(100%,15rem)]` so actions wrap under on phones. No editorial headline.
- Card: 20px radius, --fin-shadow, @container; sunken bands for table headers/footers/driver panels.
- Figures: hero font-display clamp(2rem,1.3rem+2.6cqi,3rem), 600, -0.035em, secondary figure right. `Figure`/`useCountUp` counts from 0 on first view, then from the previous value either way with a 6px blur that clears. Money is integer minor units through `useMoney` (Intl, currency's own fraction digits).
- Tables: 14px rows, min-height 64px, hairlines; 12.5px sentence-case header on a sunken band; monogram tiles, 12px mono IDs, tabular figures, money right-aligned; 2px accent rail marks selection.
- Shared pieces: `Button` (primary/secondary/ghost; 36px, 44px on coarse pointers; spinner in place; press 0.97), `enter()` (12px rise from 8px blur), `swap()` keyed crossfade, one `MOTION` token object.
- Decisions: pending; success with receipt (spring check disc + dashed-rule details list); failure keeps the draft with Try again.
- Paper: documents (invoice, reminder email) are light paper in both themes.
- Stage top-aligned (items-start) so height changes don't jump the card.
- One playful beat: a stamp spring (420/17).
- Demos: the live player's synthetic events can't move native range inputs; drive demos with buttons and custom pointer targets.
