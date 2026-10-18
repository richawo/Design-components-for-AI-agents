# Brand Colour Swatches

Build this self-contained React 19, Tailwind CSS v4 and motion/react component. Choose a brand colour by seeing type and a precise hex value on the colour itself.

A split colour study: a 192px colour field with oversized serif Aa and a hex caption, over a neutral swatch tray. Swatches wrap at narrow widths. Keep neutral #111111/#ffffff panels, #f5f5f5/#171717 ink, #a3a3a3/#525252 secondary text and #333333/#d4d4d4 hairlines. Use #727272/#8a8a8a borders to identify preset buttons and the custom picker, 14-16px body text, an 18px label, a 96px serif specimen and a 12px mono hex caption. Interactive targets remain at least 44px.

- Accept six-digit hex strings only; filter malformed presets and render Chalk for an invalid selected value.
- Keep presets as labelled pressed buttons in a named group; empty presets retain the custom colour picker.
- Use the higher-contrast choice of pure black or white for both the specimen and its small hex caption.
- The host owns controlled values. A missing writer or disabled prop makes both preset and custom editing unavailable. Do not emit a change for a valid already selected colour. Selecting Chalk from an invalid stored value still proposes a repair.

Use a brief 8px entrance with opacity. Respect reduced motion on first view and when changed while mounted. Keep visible keyboard focus, meaningful pressed/value states and instance-scoped labels. Verify 320/390/768/1024/1440/1920px containers and both themes. Preserve the complete offline default demo and its named data-demo targets. Avoid marketing headers, invented security claims, decorative status badges and remote dependencies.
