# Control kit

The canonical slider, checkbox, radio, switch and number stepper. Use these
instead of a browser-default control or a one-off restyle. A component that
needs one of these controls embeds the kit; it doesn't invent its own.

Components are single self-contained files, so they can't import shared CSS.
`controls.css` is the one source. `scripts/sync-controls.mjs` copies the modules
a component asks for into that component's own CSS, namespaced with its prefix.
`npm test` fails when an embedded copy drifts from the source.

## Embedding

Put an empty marker block in the component's CSS (a template literal inside its
`<style>`), naming the modules and the component's class prefix, then sync:

```css
/* @controls range check prefix=cs */
/* @controls end */
```

```bash
node scripts/sync-controls.mjs          # fills or refreshes every block
node scripts/sync-controls.mjs --check  # CI: fails on drift
```

Never edit inside a block. Change `controls.css` and sync, and every component
picks up the change. Map the component's tokens on its root:

```css
.cs-root {
  --cs-ctl-ink: var(--cs-ink);         /* fills, checked boxes, focus ring */
  --cs-ctl-surface: var(--cs-surface); /* glyphs drawn on ink */
  --cs-ctl-line: var(--cs-line);       /* idle borders and tracks (optional) */
  --cs-ctl-accent: #e5484d;            /* only when the fill carries meaning */
}
```

Without them the kit falls back to `currentColor`, which suits most surfaces.

## Markup

The real `<input>` stays in place, so labels, forms, keyboard and screen
readers work without extra code. Wrap each control in a `<label>` with its text,
or give it `aria-label`.

### `range`

```tsx
<input
  className="cs-ctl-range"
  type="range" min={min} max={max} step={step} value={value}
  onChange={(e) => setValue(Number(e.target.value))}
  style={{ "--cs-ctl-v": (value - min) / (max - min) } as CSSProperties}
  aria-valuetext={`${value} px`}
/>
```

`--{p}-ctl-v` is the 0–1 position; the fill is computed from it so it meets
the thumb's centre exactly at both ends. Add `data-variant="scrub"` for media
timelines: a hairline track whose thumb appears on hover, focus and drag
(always shown on touch). Its fill tracks the value exactly, so an empty timeline shows no fill. When the range crosses zero (letter spacing −1.5…12, a
turn of −90…90°), add `data-fill-from` and `--{p}-ctl-origin` (zero's 0–1
position) so the fill grows outward from zero instead of from the minimum. Show the value in an `<output>` with tabular numerals
and tween it as it changes.

### `check`

```tsx
<span className="cs-ctl-check">
  <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
  <svg viewBox="0 0 18 18" aria-hidden="true">
    <path data-mark="check" pathLength={1} d="M4.5 9.4l3 2.9 6-6.6" />
    <path data-mark="dash" pathLength={1} d="M5 9h8" />
  </svg>
</span>
```

The check draws in when checked and retracts faster when cleared. Set
`input.indeterminate` from a ref for mixed state; the dash draws instead.

### `radio`

```tsx
<input className="cs-ctl-radio" type="radio" name="speed" value="1x" checked={…} onChange={…} />
```

The dot grows from the centre. A group of large choices (plans, cards) is a
radio-card pattern, not this control; see `selects-radio-cards`.

### `switch`

```tsx
<span className="cs-ctl-switch">
  <input type="checkbox" role="switch" checked={on} onChange={(e) => setOn(e.target.checked)} />
  <span />
</span>
```

The knob stretches while pressed and travels on `ease-out`. It mirrors in RTL.

### `stepper`

```tsx
<div className="cs-ctl-stepper" role="group" aria-label="Seats">
  <button type="button" aria-label="Fewer seats" disabled={value <= min} {...hold(-step)}><Minus aria-hidden /></button>
  <input inputMode="numeric" value={draft} style={{ "--cs-ctl-ch": 3 } as CSSProperties}
    onChange={…} onBlur={commit} onKeyDown={arrowKeys} aria-label="Seats" />
  <button type="button" aria-label="More seats" disabled={value >= max} {...hold(step)}><Plus aria-hidden /></button>
</div>
```

`--{p}-ctl-ch` is the field width in characters. Keep a draft string while
typing, clamp on blur and Enter, and step with ArrowUp/ArrowDown (Shift for ×10).
Buttons repeat while held: 400 ms before the first repeat, then every 60 ms.

## The bar

- Track 4 px, thumb 18 px; checkbox and radio 18 px; switch 36 × 20; stepper
  36 px tall. The slider and stepper grow to 44 px on coarse pointers; a
  checkbox, radio or switch gets its 44 px target from the label row around it,
  so always give that row a 44 px minimum height.
- Kit inputs reset their own margin, and that reset beats Tailwind utilities
  (which live in a cascade layer). Put spacing such as `mt-px` on the wrapper
  span or a surrounding element, not on the `<input>`.
- Hover is one step (a 6 px halo on the thumb, a stronger border on boxes).
  Press scales the thing being pressed. Focus-visible is a 2 px ring, offset 2 px,
  with no transition.
- Disabled is 40% opacity and `not-allowed`, with no hover response.
- Reduced motion keeps colour changes and drops transforms. Forced colours fall
  back to the native control.
