# Legal suite shared language (from q31, which rebuilt legal-clause-library, legal-renewal-planner, legal-evidence-index, legal-document-requests)

Copy the token object and primitives from any of those four files (registry/pro/legal-*/); they are identical in each.

- Tokens: one `PALETTE` object with `dark` and `light`, identical keys: stage, surface, raised, sunken, line, lineStrong, ink, body, muted, faint, hover, paper, paperInk, paperBody, paperMuted, paperLine, paperSuccess, paperDanger, success, caution, danger, shadow, raisedShadow, paperShadow. `themeVars()` maps them to `--lg-*` vars on the root plus `--lg-accent` and `--lg-accent-ink` (WCAG luminance via `inkOn`). Default accent `#5b8def`; accent control swatches `#5b8def`, `#e5484d`, `#8b7cf6`, `#0ea5a4`.
- Colour roles: accent = selection bars, as-of line, defined terms, exhibit stickers, stamps. Primary buttons are ink (white on dark), never accent. Semantic colours only for status (success received/intact, caution closing, danger missed/broken).
- Paper (the suite's signature): whatever is the actual document is a light paper sheet in both themes, set in Instrument Serif, with `paperShadow`.
- Header: compact chrome bar. Left: breadcrumb `Crumbs` 13px muted with chevrons, hairline divider, h1 entity name 15px/600. Right: one status/progress element and actions. Crumbs hide below a 448px container (`@max-md`).
- Frame: radius 20px, inset top light, 1px ring, deep drop shadow. Raised panels radius 14px. Sunken wells use an inset hairline.
- Type: body 15px, rows 14px, metadata Geist Mono 12px (uppercase eyebrows tracking 0.06em), figures Geist display 22–28px tabular.
- Primitives: `Button` (primary/secondary/ghost, spinner in same box while pending); `Count` tweens from the on-screen value (StrictMode-safe); `Measured` animates measured height; `Stamp` lands scale 1.6→1, −6°, spring 420/18 (the one playful beat); selection pills/bars travel on `layoutId` with spring.ui; control kit embedded per slug prefix; lines < 120 chars with a `cx()` helper.
- Motion: variants `rise` (10px rise, 6px blur, 50ms stagger) and `swap` (keyed crossfade, outgoing first). Don't wrap first-render content in `AnimatePresence initial={false}` (it suppresses the subtree's entrance).
- Async decisions: pending; success with receipt or stamp; failure (`role=alert`) that keeps the draft and offers Try again; outcomes announced in a polite live region.
