# Fashion suite shared language (from q37: fashion-wholesale-order, fashion-exchange-selector, fashion-assortment-planner, fashion-launch-calendar)

Copy verbatim from those four sources (registry/pro/fashion-*/).

- House: fictional "Ferne". SKUs like FN27-KN212, stockist "Harlow & Finch, Bath", stores Marylebone, Shoreditch, King Street Manchester, etc.; owners as initials. Consistent colourways: Camel #b98a5a, Ecru #e9e2d0, Forest #2f4a3a, Ink #23262d, Oxblood #6b2430, Stone #bdb6a6, Rust #a2512e, Midnight #1f2a44.
- Tokens: `PALETTE.dark` / `PALETTE.light` written to `--<prefix>-*` (pick your own prefix). Dark panel #0c0c0e, raised #141417, ink #f4f4f5, good #5bd08a, warn #f2b35e, bad #ff7d6c. Light panel #fff, raised #fafafa, ink #111113, good #1a6b3d, warn #875006, bad #b1402d. Same shadow/lift strings and a glass value.
- Accent: one `accent` prop defaulting to the theme ink (passing either ink follows the theme); `--x-accent-ink` by luminance. Control default #f4f4f5, options #f4f4f5, #ff8a4c, #8ab4ff, #e7c27d.
- Header: 36px ink square with brand initial, 13px breadcrumb (ids mono), entity name 17px medium, status pill (dot + label), mono metadata chips or actions right. No eyebrow, no big title.
- Surfaces: root panel radius 20px, hairline, inset top light, deep shadow; raised cards radius 14px with lift shadow; sketch tiles with a radial top light.
- Garments: the `SKETCHES` map (tee, crew, shirt, coat, trouser, dress) on a 200x240 viewBox; body filled with the colourway, thread stroke by luminance, left-to-right shade gradient, dashed topstitching; an `image` prop replaces the sketch. Swatches round with radial sheen. Reuse these for any garment you show.
- Type: Geist; Geist Mono for SKUs, ratios, metadata. 14–15px tables/body, 12–13px labels, figures 20–30px tight tracking tabular. Muted never below ink/60 (AA in light).
- Motion: `rise` (10px, 8px blur, 0.56s, [0.22,1,0.36,1], 50–60ms stagger) with a `useReveal()` hook that swaps to fade under reduced motion; `useCountUp`/`CountUp` (motion values + clearing blur, sr-only value); meters fill after their block lands; keyed blur crossfades between states; receipts get a drawn check or a sprung stamp.
- Workflow: pending spinner inside the same button, success receipt, failure role="alert" with draft kept, Intl money with the currency's decimals, designed empty state.
