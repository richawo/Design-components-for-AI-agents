Build an environment-variable editor in React 19 + Tailwind CSS v4 (with `@container` queries) + `motion/react`. It is the env panel of a deployment console: secrets stay masked until asked, each key declares which environments hold it, a pasted `.env` never silently overwrites, and any edit raises a redeploy banner.

**Layout**
- A `section` with `@container`, max-width 920px, 20px radius, surface `#0d0d0f` (light `#ffffff`), an inset 1px hairline, a 1px top highlight and a deep shadow `0 40px 80px -40px rgba(0,0,0,0.9)`. Padding 20px, 24px from `@xl`.
- Header: an accent dot and the project name in mono 12.5px; on the right, “6 in production” in mono 11px, the count tweening when it changes.
- Toolbar: a radiogroup of Production, Preview and Development, each with its set-count. Chips are 44px tall and use short labels (Prod, Prev, Dev) below `@lg`, 32px with full names from `@2xl`. “Import .env” is a full-width 44px button below `@2xl` and a 32px button beside the chips from there.
- The list sits in a well (`#09090a`, light `#fafafa`), 14px radius, hairline. From `@lg` it caps at 28rem and scrolls inside itself. Below that it grows with the rows.
- A row is one column below `@lg` and a three-column grid from there: key (13.5rem) with “secret · 6d ago” in faint mono 11px, the value, then three scope buttons. Scope buttons are 44px and equal-width below `@lg`, 32px from there.
- Keys not set in the current environment sit under a faint “Not in production” label. The import panel opens above the list. The redeploy banner sits under the list.

**Typography**
- Keys, values, counts and the import field are Geist Mono 12.5px, leading 1.45–1.55, tabular numerals. Scope and environment labels are Geist 12.5px. The banner sentence is 13.5px.

**Colour**
- Dark: ink `#ededef`, muted `#98989a`, faint `#7d7d80`, hairlines `rgba(255,255,255,0.08)`. Light: ink `#17171a`, muted `#5d5d5f`, faint `#6f6f72`.
- Semantic colour only on import verdicts and the deployed dot: invalid `#f07c80` (light `#c2353b`), duplicate `#f5b452` (light `#a8620a`), deployed `#5fc284` (light `#23884a`).
- One accent, default `#7cc4ff`: the project dot, the word “new” on a paste, and the redeploy mark. Masked secrets are muted; revealed and plain values are ink. No per-environment hues.

**Behaviour**
- A masked secret shows its shape: `postgres://ledger:••••@db.ledgerline.dev/ledger`, `sk_l••••aN3p`. The port is hidden with the password. A long value may wrap after `://`, `@` or before a path, so a word is never split. Reveal is per key. Plain keys (`NEXT_PUBLIC_*`, `LOG_LEVEL`) are never masked.
- Turning a scope on restores that environment’s stored value, copying from another environment if it was empty. Turning it off keeps the value for next time. Either edit increments the undeployed-change count.
- Import parses `KEY=value`, strips `export ` and surrounding quotes, ignores blanks and `#` comments, and leaves the last unfinished line quiet. Invalid keys (not `^[A-Z_][A-Z0-9_]*$`), empty values, and duplicates are flagged and not written. Apply adds only new keys, to the current environment, then closes the panel.
- Redeploy holds its width, shows a spinner for 880ms, then “Deployed” and clears the count.

**Motion**
- Header and toolbar rise 10px out of a 6px blur, 60ms apart, 560ms on `cubic-bezier(0.22, 1, 0.36, 1)`.
- The active environment pill travels with `layoutId` on a spring (stiffness 500, damping 40). Rows use the same spring when they move between “set here” and “not in this environment”.
- The import panel opens over 320ms (height plus opacity) and closes in 180ms on ease-in. Values cross-fade with a 4px rise and a 2px blur. The banner enters with an 8px rise and a 3px blur. The set-count eases over 420ms.
- Reduced motion: opacity only, 150ms or less; no blur, rise, or count.

**Accessibility**
- The environment control is a labelled radiogroup. Scope buttons are toggles with `aria-pressed` and a name that includes the key. Reveal is a toggle named “Reveal STRIPE_SECRET_KEY”.
- The import field has a visible label. Verdicts and the banner are `aria-live="polite"`. Escape closes the import; ⌘↵ applies it.
- Focus rings are 2px ink outlines, keyboard only. Touch targets are 44×44px below `@lg`.

**Don't**
- Don't show a full secret in a `title` tooltip while it is masked.
- Don't overwrite a key that already exists; flag it and skip it.
- Don't colour environments or whole rows. Tone belongs to the verdict word and the deployed dot.
- Don't ping the header dot. This panel is not a live stream.
- Don't write invalid keys, and don't treat the line still being typed as an error.

Subsequent numeric changes move from the currently displayed value in either direction. A quick reversal continues from its interrupted position. Reduced motion shows the target immediately and clears any residual blur.
