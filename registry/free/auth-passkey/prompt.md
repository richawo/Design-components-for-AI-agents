Build a passkey sign-in card in React + Tailwind CSS v4 + `motion/react`. One focused card, no page around it. Its idea: the fingerprint is the interface. It draws itself in, a scan line reads it while the device answers, and on success it fills with light from the core outward.

**Layout**
- Card: max-width 400px, `#0b0b0c`, 1px `white/8%` border, radius 28px, inset top highlight `inset 0 1px 0 white/6%`, shadow `0 40px 80px -32px rgba(0,0,0,.9)`. Padding 40/36/28px (32/24/24px under a 360px container). Everything centred.
- Stack: brand mark (20px rounded square) + name, heading, one-line description (max 30ch), the glyph well (164px, 148px small), a status block with a reserved 52px height, the primary button (48px, radius 14px, full width), and a 44px row for "Cancel" / "Use email instead".

**The glyph**
- Hand-built SVG in a 120 viewBox, clipped to a circle of radius 47. Ten ridges at radius 3.6 + i×5.05, each an arch (x = cx + r·sin t, y = cy − 1.24r·cos t) whose legs run down and slightly in below the equator. Each ridge centre sits 0.55 units lower than the last. Break ridges once or twice at seeded angles so it reads as a print, not as rings. Stroke 2, round caps.
- The well: a circle with a 7% hairline, a faint top-lit radial and an inner shadow at the bottom.
- Three layers draw the same ridges: base (white/26%), a scan layer in near-white masked by a moving 34-unit gradient band, and a mint `#8ff0c4` layer masked by a radial circle.

**Motion**
- Entrance: card rises 12px and fades over 600ms `cubic-bezier(.22,1,.36,1)`. Ridges draw with `pathLength` 0→1 over 900ms, each delayed 250ms + 550ms × (distance from the core / max), so the print grows outward.
- Awaiting: the band and a 1px scan line with a 6-unit haze travel top → bottom → top over 2.6s, `ease-in-out (.65,0,.35,1)`, looping. Ridges brighten only where the line passes.
- Success: the mask circle grows r 0 → 90 over 850ms, so mint light spreads from the core to the rim; a soft mint bloom fades in behind the well; at 550ms a 40px mint badge springs in (stiffness 500, damping 28) at the lower right and its check draws over 360ms. The button turns mint with "Signed in" and a drawn check.
- Cancel / timeout: the glyph settles (scale 1 → .97 → 1, 600ms), ridges dim to white/20%. Error tints ridges rose and shows a small "!" badge.
- Status copy and button labels cross-fade: 6–8px offset, 3–4px blur, 220–240ms in, 120–140ms out.
- Reduced motion: no drawing, no scan travel (the band rests at the centre), success is a fade; opacity only.

**Colour**
- Stage `#000`, card `#0b0b0c`, text `#f4f4f5`, muted `#8b8b93`, hint `#6c6c74`. Primary button `#f4f4f5` on `#0b0b0c` text, hover `#fff`. Mint `#8ff0c4` is the only accent; rose `#ff8a8a` for error.

**Typography**
- Heading Geist display, semibold, `clamp(1.6rem, 1.3rem + 1.2cqi, 1.875rem)`, tracking −0.035em, leading 1.05. Body 14.5px / 1.55. The idle credential hint is mono 11.5px.

**States**
- idle, awaiting (spinner + "Waiting for device", Cancel link), success, cancelled, timeout, unsupported (feature-detected via `window.PublicKeyCredential` or forced by prop; ridges at 12%, primary becomes "Continue with email"), error (message from the rejection).
- `onAuthenticate(signal)` returns a promise. `NotAllowedError` / `AbortError` mean cancel; anything else is an error. Cancel and `timeoutMs` abort the signal.

**Accessibility**
- Section labelled by the heading; the status block is `aria-live="polite"`; the svg has a state-aware `aria-label`; the button sets `aria-busy`. Focus rings: 2px white outline offset 3px, keyboard only. Cancel returns focus to the primary button. Press scale .975.

**Don't**
- No lucide fingerprint icon: draw it. No pulsing glow ring, no blue "biometric" gradients, no shake on error, no confetti on success.
