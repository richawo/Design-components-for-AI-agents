Build a developer-tool hero in React + Tailwind CSS v4 with `motion/react`. On the left, a confident headline. On the right, a terminal in which an AI agent ships a real change on a loop. It should feel like the best devtool launches: dark, exact, quietly alive.

**Stage**
- `#070708` background with warm off-white text `#f2eee6`.
- A 56px hairline grid at `white/3.5%`, masked by a radial ellipse centred behind the terminal so it fades out.
- A soft acid-lime radial glow (`rgba(212,255,58,0.10)`) behind the terminal.

**Top row**
- Brand: a small two-square mark plus the name in semibold display (22px, tracking −0.04em).
- Right: a mono 11px uppercase release link with a lime dot and an arrow that nudges on hover.

**Copy** (6 of 12 columns at lg; stacked above the terminal on mobile)
- Headline: display font, bold, `clamp(2.75rem, 1.5rem + 4.8vw, 5.5rem)`, leading 0.95, tracking −0.05em, max 12ch.
- One phrase ("boring parts") sits in the same font at 45% opacity, no-wrap. Two tones, no italic.
- Body: 17px, 1.6 leading, 65% opacity, max 46ch.
- Actions:
  - a cream button (`#f2eee6` on `#141311`, 48px, 10px radius) with an arrow;
  - a copyable install chip: `$ npx relay@latest init` in mono 13.5px on `#0c0b0a` with a hairline border, and a Copy button that flips to "Copied" with a check for 1.6s.
- Facts row: mono 11px uppercase at 45%, each prefixed by a 12px hairline dash.

**Terminal**
- `#0c0b0a`, 14px radius, `white/9%` border, inset top highlight and two deep layered drop shadows.
- A 1px gradient edge (white 14% → 4% → 0) sits behind it.
- Tab bar:
  - two vertical pause bars;
  - an active tab with the repo name and "— relay ship", topped by a 1px highlight;
  - a ghost "+";
  - on the right, a live elapsed clock with a pulsing amber dot that becomes a lime dot and "done".
- Body: mono 12–13px at 1.75 leading, 380/440/480px tall, scrolling internally (thin scrollbar). It never causes page overflow.
- Status bar: branch name, files changed and +/− counts (lime and rose), and the version.

**The session** (a deterministic timeline replayed on a loop)
1. The cwd line with the git branch.
2. The command types out character by character, with jittered human timing and longer pauses on spaces.
3. A braille spinner "Reading 214 files…" resolves to "214 files in 1.8s".
4. A "Plan" heading, then 4 numbered steps appear 230ms apart.
5. "Writing files": a tree with ├─ └─ glyphs builds line by line, with green `+n` and rose `−n` per file.
6. "Running tests": each test spins for its own duration, then ticks lime with a timing.
7. A summary line, then a PR link card (#482, title) and a wry note ("Waiting on one reviewer. Go and get a coffee.").
8. Pause 5.2s and replay. Start only when in view (`useInView`). Auto-scroll to keep the newest line visible.

**Accessibility and motion**
- The terminal is `aria-hidden` decoration. Facts, buttons and the copy chip are real, keyboard-reachable controls.
- With reduced motion, show the finished session immediately and don't loop.

**Don't**
- No macOS traffic lights, no neon green-on-black hacker cliché and no typing sound gimmicks.
- No gradient headline, and no horizontal page scroll from long terminal lines.
