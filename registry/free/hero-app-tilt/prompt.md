Build a product hero in React + Tailwind CSS v4 with `motion/react`: headline, sub and two CTAs, then one beautifully drawn dark app window (a mail client called Tern) that starts tilted back 22° in 3D and flattens to 0° as you scroll it into place, while a soft spotlight behind it brightens. The window is real markup, not an image.

**Layout**
- `section`, `#000`, `@container`, `overflow-hidden`. Copy column `max-w-[1240px]`, centred, `pt-20` (`pt-28` from `@3xl`).
- Stage below: `mt-14` (`mt-20` from `@md`), `px-3`/`px-8`. A perspective wrapper (`perspective: 1200px`) with `mask-image: linear-gradient(to bottom, #000 52%, transparent 96%)` holds the window, so its lower half dissolves into the black.
- Spotlight: absolute, `-top-44`, 620px tall, `radial-gradient(46% 48% at 50% 40%, white 20%, white 6% at 42%, transparent 70%)` behind the window.

**Typography**
- Eyebrow: mono 11px uppercase, tracking 0.2em, white/50, after a 6px `#f2c46d` dot.
- Headline: display semibold `clamp(2.6rem, 1.1rem + 5.4cqw, 5.75rem)`, leading 0.97, tracking −0.055em, max 15ch, balanced; “before coffee.” at white/45.
- Body: 16/17px, leading 1.6, white/60, max 50ch.

**Scroll link (the signature)**
- `useScroll({ target: windowFrame, offset: ["start end", "start 20%"] })`.
- If the frame is already in view on load (a hero usually is), measure its untransformed top (offsetTop chain) and rescale: `p = clamp((v − p0) / (1 − p0))`, where `p0 = (vh − top) / (0.8·vh)`. So it always starts fully tilted and flattens over the scroll that actually exists. Re-measure on resize.
- Smooth with `useSpring` (stiffness 170, damping 32, mass 0.5); jump on first measure.
- Map: `rotateX = (1 − p) × tilt` (default 22°), `scale 0.94 → 1`, `y 24 → 0px`, `transform-origin: 50% 0%`; spotlight opacity 0.22 → 1; a 1px top edge light (white 55% across the middle 40%) 0.15 → 0.4 → 1.
- Reduced motion: p = 1 (flat, spotlight full), no spring, copy without blur.

**The window (`figure role="img"` with a descriptive `aria-label`; its own `@container/win`)**
- Shell: `#0a0a0b`, radius 14px (18px from `@3xl`), 1px white/9% ring, shadow `0 50px 140px -30px rgba(0,0,0,.9)`.
- Title bar 44px: three 11px dots at white/14 (grey, not traffic-light colours), a centred 28px search field (“Search or jump to…”, ⌘K), a 24px initials avatar.
- Body height 440 / 520 (`@xl/win`) / 600px (`@4xl/win`):
  - Sidebar 212px (from `@4xl/win`): logo tile + “Tern”, Compose with key hint, “Triage” group (Reply 12 selected at white/7%, Read later 31, Ignored 208), divider, Inbox / Drafts 9 / Snoozed / Sent with 15px hand-drawn icons, Labels with grey squares, and an “Overnight: 4 drafts ready” card with a gold progress bar.
  - List 340/372px (full width below `@2xl/win`): header “Reply 12” with an All/Drafted segmented control; rows with tinted-grey 32px initials avatars, sender (unread semibold + 6px dot), time, subject, one-line preview and a gold mono “Draft” chip. Selected row at white/5.5% with a 2px left bar.
  - Detail (from `@2xl/win`): Archive / Snooze / Label, “1 of 12”; subject 19–21px semibold; sender line; two body paragraphs at 13.5px/1.65; then the drafted reply card (white/3.5%, inset white/8% ring, radius 12px): gold mono “Drafted by Tern · in your voice”, two paragraphs, a white “Send ⌘↵” button, “Edit”, and the attachment name.
- One accent, `#f2c46d`, only for the eyebrow dot, Draft chips, the draft label and the progress bar.

**CTAs**
- Primary: 48px white pill with a download glyph that dips 2px on hover; bg → `#ececec`. Secondary: inset white/14% ring, chevron nudges 2px right. Press 0.97 in 75ms; 2px white focus ring offset 4px. Stacked full width below `@md`.

**Demo**
- Add a 45vh black runway under the hero so there is room to scroll the window flat.

**Don’t**
- No coloured traffic lights, no gradient borders, no glass, no glow around the window. Don’t scale the window up to full width with an image; draw it. Don’t keep tilting after it’s flat, and don’t tie it to page scroll globally.
