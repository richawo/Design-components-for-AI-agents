Build a developer-tool hero in React + Tailwind CSS v4 with `motion/react`. On the left, a confident headline; on the right, a terminal in which an AI agent ships a real change on a loop. Dark, exact, quietly alive, and monochrome: the only colour is the confirmation when you copy the install command. It's the hero section alone: no brand bar, nav or release announcement inside it.

**Tokens** (one `COLORS` object at the top, written to CSS variables on the root; no inline hex in class names)
- Page `#09090b`, terminal and chip surface `#0f0f11`, ink `#f4f4f5`, text on light surfaces `#09090b`.
- Accent: one `accent` prop, default `#d4ff3a`, used only for the "Copied" state of the install chip. Ticks, spinners, the diff counts, the PR marker and focus rings are ink at an opacity.
- Named constants for the session delay (800ms), spinner frame (80ms), clock step cap (100ms), copied hold (1.8s), tilt (1.5°) and the session pacing.

**Layout**
- `@container` root, container max 1280px, padding 20/32/48px, vertical 64/80/112px. From `@5xl` (64rem) a 12-column grid with copy and terminal in 6 each; below that the terminal follows the copy.
- A 56px hairline grid at white/3%, masked by a radial ellipse centred behind the terminal: texture, not a glow. No radial colour blobs.
- Headline: display bold `clamp(2.75rem, 1.4rem + 4.6cqi, 5.25rem)`, leading 0.95, tracking −0.05em, one prop string per line ("The agent / that does the / boring parts / of shipping."). The emphasis phrase sits at 45% ink, no-wrap. No italic, no colour.
- Body 17px, leading 1.6, ink/65, max 46ch.
- Actions: a 48px ink button (10px radius, dark text, arrow nudging 3px on hover), and a copyable install chip (`$ npx relay@latest init` in mono 13.5px on the surface, ink/15 hairline) whose Copy button flips to an accent "Copied" with a check for 1.8s. Below `@md` both go full width.
- Facts: mono 11px uppercase at ink/45, each after a 12px hairline dash.

**Terminal**
- Surface `#0f0f11`, 14px radius, ink/9% border, an inset white/6% top highlight and two deep black drops.
- Tab bar: a pause button (two bars that morph into a play triangle), the active tab (repo name and "— relay ship") topped by a 1px ink/40 highlight, a ghost "+", and on the right an elapsed clock with an ink/45 dot that becomes "done" (or "paused").
- Body: mono 12–13px at 1.75 leading, 380/440/480px tall, scrolling internally with a thin scrollbar and auto-scrolling to the newest line. Each new line fades up 4px from a 3px blur over 220ms.
- Status bar: work branch, files changed and +/− counts that tween to each new value, and the version.

**The session** (a deterministic timeline replayed on a loop)
1. The cwd line with the git branch.
2. The command types out with jittered human timing and longer pauses on spaces.
3. A braille spinner "Reading 214 files…" resolves to "Read 214 files in 1.8s".
4. "Plan", then 4 numbered steps 230ms apart.
5. "Writing files": a ├─ └─ tree builds line by line with `+n` (ink/80) and `−n` (ink/40) per file.
6. "Running tests": each test spins for its own duration, then ticks in ink with its timing.
7. The summary in ink, then "◆ Opened pull request #482", its title and a wry note ("Waiting on one reviewer. Go and get a coffee.").
8. Hold 5.2s and replay.
- Engineering: `buildTimeline` returns the rows, the total and every moment something changes. One rAF clock keeps time in a motion value (the spinner and the elapsed clock are `useTransform`s of it, rendered as motion children) and sets React state only when it crosses one of those marks. It runs only while the terminal is revealed and on screen, not in hidden tabs and not while held, and caps each step at 100ms.

**Entrance** (ease `[0.22, 1, 0.36, 1]`)
1. Copy, once the hero is 20% in view: headline lines rise 12px out of an 8px blur, 550ms, 65ms apart; body at 0.26s, actions at 0.32s, facts from 0.38s, 40ms apart.
2. The terminal has its own once-only trigger at 30% (it's below the fold on phones): the frame rises 24px out of an 8px blur over 700ms at 0.3s; the header hairline draws, then the pause button, tab (its top highlight draws), "+" and clock land 40ms apart from 0.42s; the status bar and its hairline at 0.52s.
3. The session's first line prints 800ms after the frame starts, once the window has landed.
- Reduced motion: the finished session shows immediately with no loop, no tilt and no blink; everything fades in together over 150ms; counts are set instantly.

**Accessibility**
- A real `h1` labels the section. The terminal body is a `role="log"` with `aria-live="off"`; the pause button has `aria-pressed` and a label; the copy chip has a descriptive label and a polite live region for "Copied".
- Focus rings 2px in ink, offset 3px, instant.

**Don't**
- No lime, amber or green terminal colours, no glow blobs, no gradient edges or button glows.
- No macOS traffic lights, no hacker cliché, no typing sounds.
- No per-frame React state, and no horizontal page scroll from long terminal lines.

**Feel**
- The terminal tilts up to 1.5° toward a mouse pointer on a soft spring (stiffness 180, damping 22) and levels out on leave.
- The CTA lightens to white on hover and presses to 0.98; the chip presses to 0.98 and its icon pops between copy and check on `spring.ui` (500/30).
