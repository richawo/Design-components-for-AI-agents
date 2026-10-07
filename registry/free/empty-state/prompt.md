Build an `EmptyState` component in React + Tailwind CSS (v4) with `motion/react` and `lucide-react`: three empty states (inbox zero, no search results, first project) chosen by a `variant` prop. Each gets its own hand-drawn SVG scene, copy with some personality, and an obvious next step. The demo shows all three inside small app frames.

**Layout (the empty state)**
- A centred column with 40px vertical padding and 24–40px side padding.
- The illustration sits on top, `min(256px, 76%)` wide, from a 240×160 viewBox.
- Then a mono meta line ("Inbox · 0 unread", "0 of 2,731 items", "Projects · none yet"), 11px, uppercase, 0.14em tracking, 50% ink, 28px below the art.
- Title in display, `clamp(1.375rem, 1.2rem + 0.6vw, 1.625rem)`, weight 600, leading 1.15, tracking −0.025em, max 22ch, `text-wrap: balance`. In the search variant, the query follows in italic serif at 1.12em inside curly quotes: Nothing matches “quarterly vibes”.
- Body 15px, leading 1.6, 65% ink, max 38ch, `text-wrap: pretty`.
- Actions: a 44px dark pill (`#1d1c1a`, text `#fffdf9`) with an icon that suits the variant (pen, arrow, plus) and a quiet 44px text button (hover fills 6% ink).
- The search variant adds suggestion chips: 36px white pills with a 14% ink ring and a small search icon, turning apricot tint on hover. The project variant adds "Or start from a template" under a dashed rule, with chips that each carry a tiny geometric glyph.

**Illustrations**
- One drawing language: ink `#1d1c1a` lines at 1.6px with round caps and joins, paper fills `#fffdf9`, a shade `#ebe6dc`, one apricot accent `#ef8f4a` and its tint `#fde3cc`. Every scene sits on a soft shade ellipse as its ground shadow.
- Inbox: an empty letter tray with an apricot label, a paper plane leaving along a dotted looping flight path, and a mug of tea whose two steam curls rise and fade.
- Search: three fanned index cards with faint ruled lines, and a magnifier whose tinted lens shows a bold apricot "0". The handle is apricot inside an ink outline. The magnifier drifts slowly from side to side.
- Project: a cutting mat with a 12px grid pattern and ruler ticks, a blank sheet tilted −4° with a folded corner, a dashed frame with marching ants around an apricot plus disc, and an apricot pencil lying across the mat.
- `<defs>` ids (clip path, pattern) come from `useId()`.

**Demo**
- Background `#f4f1ea`, max width 80rem. Header on a 12-column grid: a mono kicker, then the headline "Nothing here, *on purpose.*" in display, `clamp(2.75rem, 1.6rem + 4.4vw, 5.5rem)`, leading 0.92, tracking −0.05em, with the italic serif in burnt apricot `#c9601e`. A 16px intro sits in 5 columns, bottom-aligned.
- Three frames (one column below 1024px, three from 1024px up, 16–20px gaps): `#fffdf9`, 20px radius, a 1px ring at 8% ink and a long soft shadow. Each has a 56px header bar: mail tabs (Primary, Updates, Snoozed), a real search input, or "All projects 0".
- The demo's search input is live: submitting it, or pressing a suggestion chip, updates the query in the title.

**Motion**
- Steam: y 4 → −4 and opacity 0 → 1 → 0 over 2.6s, staggered 0.9s. The paper plane bobs 3px over 4s. The magnifier sweeps x −14 → 18 with ±4° rotation over 6s. Marching ants run with a `stroke-dashoffset` loop over 1.6s.
- With `prefers-reduced-motion`, everything is static.

**Accessibility**
- Each empty state is a `role="region"` labelled by its heading. Illustrations are `aria-hidden`.
- Real buttons with visible apricot focus rings. Suggestion chips are a labelled list. The search uses `role="search"` and a labelled input.

**Don't**
- No clip-art, stock illustration, emoji or gradients. Don't use a generic grey box icon with "No data".
- Don't use a different illustration style per variant. One line weight, one accent.
- No guilt-trip copy ("You haven’t done anything yet!").
