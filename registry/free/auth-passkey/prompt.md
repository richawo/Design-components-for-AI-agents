Build a passkey sign-in card in React + Tailwind CSS v4 + `motion/react`. One focused card, no page around it. Its idea: the fingerprint is the interface. It draws itself in, a scan line reads it while the device answers, and on success it fills with light from the core outward.

**Layout**
- Card: max-width 400px, surface, 1px hairline border, radius 28px, inset top highlight `inset 0 1px 0 white/6%`, shadow `0 40px 80px -32px rgba(0,0,0,.9)`. Padding 40/36/28px (32/24/24px under a 360px container). Everything centred.
- Stack: brand mark (20px rounded square) + name, heading, one-line description (max 30ch), the glyph well (164px, 148px small), a status block with a reserved 52px height, the primary button (48px, radius 14px, full width), and a 44px row for "Cancel" / "Use email instead".

**The glyph**
- Hand-built SVG in a 120 viewBox, clipped to a circle of radius 47. Ten ridges at radius 3.6 + i×5.05, each an arch (x = cx + r·sin t, y = cy − 1.24r·cos t) whose legs run down and slightly in below the equator. Each ridge centre sits 0.55 units lower than the last. Break ridges once or twice at seeded angles so it reads as a print, not as rings. Stroke 2, round caps.
- The well: a circle with a 7% hairline, a faint top-lit radial and an inner shadow at the bottom.
- Three layers draw the same ridges: base (white/26%), a scan layer in near-white masked by a moving 34-unit gradient band, and a success-colour layer masked by a radial circle.

**Motion** (one `MOTION` object; ease-out `cubic-bezier(.22,1,.36,1)`)
- Entrance, once at 30% in view: the card rises 16px out of a 10px blur over 600ms. Inside it, brand → heading → description → glyph well → status → button → link stagger 50ms apart from 120ms (opacity, 10px rise, 6px blur clearing, 450ms) via an `enter(play, delay, reduce)` helper. Once the glyph block lands, ridges draw with `pathLength` 0→1 over 700ms, each delayed 400ms × (distance from the core / max), so the print grows outward.
- Awaiting: the band and a 1px ink scan line with a faint haze travel top → bottom → top over 2.6s `cubic-bezier(.65,0,.35,1)`, looping; this is the component’s one ambient signal (the status ellipsis is static). Ridges brighten only where the line passes.
- Success: the mask circle grows r 0 → 90 over 850ms, so mint light spreads from the core to the rim, while a 1px mint ring draws round the well with `pathLength` (700ms). At 550ms a 40px mint badge springs in (500/28) at the lower right and its check draws over 360ms. The button keeps its size and its accent; “Signed in” and a drawn check cross-fade in.
- Cancel / timeout: the glyph settles (scale 1 → .97 → 1, 600ms) and ridges dim through a CSS stroke transition between tokens. Error tints ridges with the error colour and shows a small “!” badge.
- Status copy and button labels cross-fade: 6–8px offset, 3–4px blur, 220ms in, 120ms out.
- Reduced motion: 150ms fades only; no drawing, no scan travel (the band rests at the centre).
- Code: a `usePasskeyCeremony` hook owns the AbortController, timeout and Cancel; `useTimeouts` clears the timeout and the success hold on unmount, and unmounting aborts the ceremony.

**Colour** (one `PALETTE` for dark and light → `--pk-*` CSS variables)
- Monochrome first. Dark: stage `#000`, card `#0b0b0c`, ink `#f4f4f5`, muted `#8b8b93`, hint `#7a7a83`, hairline white 8%, ridges white 26% (20% settled, 12% unsupported), scan in ink. Light: card `#ffffff`, ink `#18181b`, muted `#5f5f68`, ridges ink at 28%.
- One accent (`accent` prop, default = ink) fills the primary button; its label is whichever of black or white has the higher WCAG contrast ratio on it (so a mid-tone such as `#ff7a45` gets a black label) and hover lays a 7% wash of the label colour. Mint `#8ff0c4` (light `#16a34a`) means success and nothing else; rose `#ff8a8a` (light `#dc2626`) means error.

**Typography**
- Heading Geist display, semibold, `clamp(1.6rem, 1.3rem + 1.2cqi, 1.875rem)`, tracking −0.035em, leading 1.05. Body 14.5px / 1.55. The idle credential hint is mono 11.5px.

**States**
- idle, awaiting (spinner + "Waiting for device", Cancel link), success, cancelled, timeout, unsupported (feature-detected via `window.PublicKeyCredential` or forced by prop; ridges at 12%, primary becomes "Continue with email"), error (message from the rejection).
- `onAuthenticate(signal)` returns a promise. `NotAllowedError` / `AbortError` mean cancel; anything else is an error. Cancel and `timeoutMs` abort the signal.

**Accessibility**
- Section labelled by the heading; the status block is `aria-live="polite"`; the svg has a state-aware `aria-label`; the button sets `aria-busy`. Focus rings: 2px ink outline offset 3px, keyboard only. Cancel returns focus to the primary button. Press scale .975.

**Don't**
- No lucide fingerprint icon: draw it. No glow bloom behind the well, no mint-filled button, no pulsing ellipsis, no blue "biometric" gradients, no shake on error, no confetti on success.
