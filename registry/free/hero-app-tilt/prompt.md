Build a product hero in React + Tailwind CSS v4 with `motion/react`: headline, sub and two CTAs, then one beautifully drawn app window (a mail client called Tern) that starts tilted back 22° in 3D and flattens to 0° as you scroll it into place, while a soft spotlight behind it brightens. The window is real markup, not an image, and everything in it is choreographed: chrome, sidebar, rows, message and drafted reply stagger in, the counts tick up from zero and the overnight meter fills last.

**Layout**
- `section`, `@container`, `overflow-hidden`, page colour from a theme token. Copy column `max-w-[1240px]`, centred, `pt-20` (`pt-28` from `@3xl`).
- Stage below: `mt-14` (`mt-20` from `@md`), `px-3`/`px-8`. A perspective wrapper (`perspective: 1200px`) with `mask-image: linear-gradient(to bottom, #000 52%, transparent 96%)` holds the window, so its lower half dissolves into the page.
- Spotlight: absolute, `-top-44`, 620px tall, `radial-gradient(46% 48% at 50% 40%, <spot>, transparent 70%)` behind the window (dark: white 20%; light: white 95%).

**Typography**
- Eyebrow: mono 11px uppercase, tracking 0.2em, ink/55, after a 6px accent dot.
- Headline: display semibold `clamp(2.6rem, 1.1rem + 5.4cqw, 5.75rem)`, leading 0.97, tracking −0.055em, max 15ch, balanced. Split at the `muted` substring into inline-blocks; the muted part is ink/45.
- Body: 16/17px, leading 1.6, ink/60, max 50ch.
- In the window one small type scale: mono 10px uppercase labels, 11.5px meta, 12.5px UI, 13px rows, 13.5px/1.65 prose, subject 19–21px semibold.

**Colour (monochrome first)**
- Tokens in one `PALETTE` object, switched by `theme`:
  - dark: page `#000`, window `#0a0a0b`, ink `#fff`, avatar `#1d1d20`, shadow `0 0 0 1px white/9%, 0 50px 140px -30px black/90%`.
  - light: page `#ececee`, window `#fff`, ink `#0b0b0c`, avatar `#ececef`, a soft grey drop shadow.
- Every other tone is ink at an opacity (hairlines 5–7%, fills 3–9%, text 35–90%). Avatars are one neutral grey, never hue-per-person; label swatches differ by grey weight.
- One `accent` prop, default gold `#f2c46d`, meaning “Tern prepared this”: the eyebrow dot, the dot inside each mono “Draft” mark (the mark itself is ink/70 on ink/5), the dot before “Drafted by Tern”, and the overnight meter fill. Nothing else is coloured.

**Scroll link (the signature)**
- `useScroll({ target: windowFrame, offset: ["start end", "start 20%"] })`, wrapped in a `useScrollFlatten` hook.
- If the frame is already in view on load, measure its untransformed top (offsetTop chain) and rescale: `p = clamp((v − p0) / (1 − p0))`, `p0 = min(0.85, (vh − top) / (0.8·vh))`, so it always starts fully tilted. Re-measure on resize.
- Smooth with `useSpring` (stiffness 170, damping 32, mass 0.5); jump on the first value.
- Map: `rotateX = (1 − p) × tilt`, `scale 0.94 → 1`, `y 24 → 0px`, origin `50% 0%`; spotlight opacity 0.22 → 1; a 1px top edge light 0.15 → 0.4 → 1.

**Entrance choreography (one `T` timeline object, seconds)**
- Shared variant: opacity 0 → 1, y 12 → 0, blur 8px → 0, 600ms `[0.22, 1, 0.36, 1]`; inside the window a smaller one (y 8, blur 6px, 500ms). Drop the filter at rest.
- Copy on mount: eyebrow 0, headline part 1 at 0.06, muted part 0.13, body 0.20, primary 0.26, secondary 0.31.
- Window, when it is 15% in view (its own `useInView`, because on phones it is below the fold): shell fades from blur at 0.28 (no transform: scroll owns that), title bar 0.38, sidebar items 25ms apart from 0.44, list header 0.46, rows 45ms apart from 0.52 (the selected row’s 2px bar draws down 150ms after its row), subject 0.54, sender 0.59, body paragraphs 0.60/0.65, draft card 0.72, draft paragraphs 0.80+, Send/Edit last.
- Numbers (folder counts, list count, “182 of 251 sorted”) count from 0 with `tabular-nums` and a 3px blur that clears, driven by a motion value (`animate()` + `useTransform`), never per-frame React state.
- The overnight meter (`scaleX` from the left to done/triaged) fills at 0.92 for 700ms, after its card has landed.
- Reduced motion: window flat, spotlight full, every block a 150ms opacity fade, numbers and meter set instantly.

**The window (`figure role="img"` with a descriptive `aria-label`; its own `@container/win`)**
- Shell radius 14px (18px from `@3xl`). Title bar 44px: three 11px ink/14 dots (not traffic lights), a centred 28px search field (“Search or jump to…”, ⌘K), a 24px initials avatar.
- Body 440 / 520 (`@xl/win`) / 600px (`@4xl/win`):
  - Sidebar 212px (from `@4xl/win`): logo tile + name, Compose with key hint, “Triage” label, the three triage folders (first selected at ink/7%), then the overnight card (“Overnight: 4 drafts ready, 182 of 251 sorted.” + 4px meter) so it sits above the bottom fade, a divider, the other folders with 15px hand-drawn icons, and Labels.
  - List 340/372px (full width below `@2xl/win`): header “Reply 12” with an All/Drafted segmented control; rows with a 32px avatar, sender (unread semibold + dot), time, subject, one-line preview and the Draft mark.
  - Detail (from `@2xl/win`): Archive / Snooze / Label, “1 of 12”; subject; sender; body; the drafted reply card (ink/3.5%, inset ink/8% ring, radius 12px) with label, paragraphs, an ink “Send ⌘↵” button, “Edit” and the attachment name.

**Code**
- Small named parts: `Headline`, `PrimaryLink`, `SecondaryLink`, `AppWindow`, `TitleBar`, `Sidebar`, `FolderRow`, `OvernightCard`, `ThreadList`, `ThreadRow`, `DraftMark`, `MessagePane`, `DraftCard`, `CountUp`, `Avatar`, `FolderIcon`; hooks `useScrollFlatten` and `useProgress`.
- Colours as CSS variables on the root (`--at-ink`, `--at-accent`, …) used as `text-(--at-ink)/60`.

**CTAs**
- Primary: 48px ink pill with a download glyph that dips 2px on hover; bg → ink/90. Secondary: inset ink/15 ring, chevron nudges 2px right. Press 0.97 in 75ms; 2px ink focus ring offset 4px. Stacked full width below `@md`.

**Demo**
- Add a 45vh runway under the hero so there is room to scroll the window flat.

**Don’t**
- No coloured traffic lights, hue-per-avatar, gradient borders, glass or glow around the window. No gold fills or gold text: the accent is a dot or a meter. Don’t pop the window in as one block, don’t start the meter before its card lands, don’t keep tilting after it’s flat, and don’t hijack page scroll.
