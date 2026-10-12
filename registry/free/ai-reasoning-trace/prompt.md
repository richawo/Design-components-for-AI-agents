Build a "Thought for 14s" reasoning trace in React 19 + Tailwind CSS v4 (`@container`, arbitrary values), using `motion/react` for the summary and the step entrances and `lucide-react` for one chevron. It is a controlled component: the host's model supplies the steps, the reply and the state, and the card only renders them. It shows what a model is doing while it thinks, then folds that work away once the reply starts. It must feel quiet, exact and monochrome, like a flight log, not a loading spinner. No sparkles, no brain icon, no rainbow shimmer, no gradient text.

**API**
- `state`: `"thinking" | "answering" | "done"`, default `"done"`. Thinking shows the live timer, the rewriting summary and the steps. Answering streams the reply and folds the trace. Done is the finished card. The component never advances on its own.
- `trace`: `{ summary: string; detail: string; atMs?: number }[]`, every step so far, in order. The host appends. `atMs` is when the step landed, in ms since thinking began, and adds a `+0.6s` stamp.
- `answer`: `string[]`, the reply so far as paragraphs. The host appends words as they stream.
- `startedAt`: `Date.now()` when thinking began. Starts the live timer. Without it the header shows the bare label.
- `thoughtForMs`: the final thinking time. Once the answer starts it wins over the measured time. Without it the card freezes the time it measured at the hand-off.
- `open`, `defaultOpen`, `onOpenChange`: controlled or uncontrolled open state. A controlled `open` stops auto-collapse, so the host owns the choice.
- `autoCollapse` (default true), `showTimer` (default true), `theme` (`"dark" | "light"`), `className`.
- `rememberChoice` (default true): once the reader opens or closes the trace, that choice holds across later runs in the same instance, so a reader who always wants the trace open is never folded again. Off, the choice lasts one run and auto-collapse applies again at the next hand-off. `storageKey` (optional) also persists the choice in `localStorage` (read after mount, every access in try/catch) and implies `rememberChoice`. A controlled `open` overrides both.
- The default export is a demo only. It streams a scripted billing reply through the same controlled component, using a hook that is never part of the library API. Its `steps` (3 to 12, default 7) and `speed` feed that hook.

**Layout**
- One `section` with `@container`, `aria-label="Reasoning"`, full width of its column. Inside, one card: 18px radius, 1px border, padding 16px 20px (24px 28px from `@md`), an inset top highlight and a deep shadow.
- Header row: `min-h-11` (44px, the touch target on mobile) and `@md:min-h-9` (36px), flex, centre aligned, gap 12px. It holds the status dot, the label, and the step-count button pushed right with `ml-auto`. The button is `h-11 @md:h-9`.
- Below it, the live summary row. It sits inside a grid whose rows go `0fr` to `1fr` (300ms, ease-out). Inside, `pt-3` (12px) and `min-h-[1.5em]`. The summary is one line and truncates with an ellipsis. At the hand-off the row folds and its text fades with it (300ms). The text does not slide, so the fold never fights a move.
- Below that, the trace region. Its outer grid goes `0fr` to `1fr` over 420ms on `cubic-bezier(0.22, 1, 0.36, 1)`, with `overflow: hidden` on the inner `min-h-0` wrapper. Collapsed it is `inert`, so nothing inside is reachable.
- The list (`ol`, `aria-label="Reasoning steps"`) has a 1px left rule (`border-l`), an indent of 16px (20px from `@md`) with a 4px left margin, steps stacked with 10px gaps and 1px bottom padding. It caps at `max-h-[14rem]` and scrolls (`overflow-y-auto overscroll-contain`). It is in the tab order (`tabIndex={0}`) only while it can scroll, so an empty or fitting list is never a dead tab stop. While thinking it scrolls to the newest step. Each end fades with one `linear-gradient` mask only when the list can scroll that way: the top 20px once it has scrolled down (`scrollTop > 2`), the bottom 24px while more lies below. A step cut by the edge never reads as a hard clip.
- Each step is a grid: `1.75rem` for a mono index, the rest for the text. With `atMs` it gains a third `auto` column for the stamp.
- The reply sits in its own fold region (grid rows `0fr` to `1fr`, 420ms ease-out in, `cubic-bezier(0.65, 0, 0.35, 1)` out). It grows in while the trace folds at the hand-off, so the card changes height once. When the host clears the reply it folds and fades out (260ms ease-in, 3px blur) instead of vanishing, keeping the last reply on screen until it has closed. Inside: a 1px top rule, padding-top 20px above and below it, 16px type (16.5px from `@md`), line-height 1.65, max 62ch per paragraph, paragraphs separated by 1.1em.

**Typography**
- Header label: mono 12px, tracking 0.01em, `tabular-nums`, muted ink. While thinking it reads `Thinking ·` then the time. Once the reply starts it reads `Thought for` then the time. With the timer off it reads `Thinking` or `Thought`. The whole label (verb, separator and digits) is one unit. When it changes (thinking or thought, timer on or off), the outgoing label stays frozen in the same grid cell (`inline-grid`, both spans at `grid-area: 1/1`) and fades out with a 3px blur over 120ms ease-in, while the incoming one fades in over 200ms ease-out after 60ms (CSS keyframes `ai-rt-label-out` and `ai-rt-label-in`; the outgoing span is `aria-hidden` and removed on `animationend`). There is never an empty slot, and the verb never sits beside the wrong separator or orphaned digits. A thinking label leaving at the hand-off shows the same frozen time the new label reads.
- The time digits are ink, not muted. While thinking they count in place: one stable span, tabular numerals, updated every tenth of a second with no remount, no blur and no per-tick animation. The clock lives in a small `Elapsed` child that owns its own interval, so the rest of the card does not re-render ten times a second. It pauses while the header is offscreen (IntersectionObserver) and while the tab is hidden, and reads `Date.now() - startedAt` again on resume. The frozen time is measured in a layout effect at the hand-off, never during render.
- Step count button: mono 12px, tabular, muted ink. It reads `Reasoning` before the first step lands, then `1 step` or `5 steps`. A 14px chevron turns 180° when open.
- Live summary: Geist 15px (16px from `@md`), line-height 1.5, tracking -0.005em, full ink.
- Trace steps: 13.5px, line-height 1.55. The index is mono 11px, tabular, dim ink. The optional stamp is mono 11px, tabular, dim ink, shown as `+0.6s`. The latest step is body ink while thinking; every other step is dim ink. The colour change takes 300ms.
- Reply words: body ink, no bold.

**Colour** (one palette written to `--ai-rt-*` CSS variables on the section; the `theme` prop picks one)
- Dark: surface `#0d0d0f`, line `#26262c`, ink `#f4f4f5`, body `#d4d4d8`, muted `#a1a1aa`, dim `#8b8b95`, hover `rgba(255,255,255,0.06)`, shadow `inset 0 1px 0 rgba(255,255,255,0.04), 0 28px 60px -36px rgba(0,0,0,0.9)`.
- Light: surface `#ffffff`, line `#e4e4e7`, ink `#18181b`, body `#3f3f46`, muted `#52525b`, dim `#60606a`, hover `rgba(24,24,27,0.05)`, shadow `0 1px 2px rgba(24,24,27,0.04), 0 28px 56px -40px rgba(24,24,27,0.28)`.
- No accent colour. The status dot is ink while thinking and settles to dim ink (200ms colour fade) once thinking ends, so a finished card never reads as live. Nothing is coloured to mean success, so there is no green tick.
- The demo stage is `#000000` (dark) or `#f4f4f5` (light). It is not part of the component.

**Demo script** (the default export only; model milliseconds, the pace divides every one)
- Before the first run the card rests finished, with its trace open and the full reply on screen. That is the tallest state the card reaches, so a recording or a screenshot framed on the first frame has room for everything. Nothing animates at rest.
- The stream starts once the card is in view (`useInView`, once, 20%) and the page has loaded and stayed quiet for 3.6s. The first pointer movement over the stage starts the script at once and restarts it from zero, so a recording or a live player that moves the cursor first starts from an empty trace. It never starts under reduced motion; the finished card is shown instead, folded, and the reader can open it.
- A run asked for holds the finished card 300ms, then folds its trace and its reply away together over 420ms (real time, not divided by the pace, so the folds always finish), and only then does thinking begin from an empty trace. Nothing cuts in a frame.
- Lead 500ms before the first step. Step i lands at a cumulative time, with a 480ms gap multiplied by a fixed rhythm `[1, 0.82, 1.18, 0.94, 1.08, 0.9, 1.15, 0.86, 1.04, 0.97, 1.12, 0.92]`. Seven steps finish the thinking at about 3.8 seconds. The script checks before it drafts: renewal and tax come before choosing the order, drafting and tone.
- The answer starts 480ms after the last step. The trace folds then, unless `autoCollapse` is off or the reader has chosen.
- The first words land 55ms later, while the trace is still folding, so the reply grows in as the trace closes. Words arrive two per tick, 55ms apart, and each word settles from a 3px blur over 320ms (keyframe `ai-rt-word`). Done is 150ms after the last word.
- The timer is real elapsed time: `Date.now() - startedAt`, refreshed every 100ms while thinking, and frozen at the hand-off.
- Changing `steps`, `speed` or `state` restarts the stream from zero. The reader's choice carries over (`rememberChoice`).
- The recorded demo: move the cursor over the stage (starting the script at zero), wait 3600ms (the trace folds at the hand-off, and the click must land after it), click the toggle to reopen the folded trace, hover the steps, scroll them, then hold 300ms. About 7 seconds, with the reply streaming in during the final beat.

**Motion**
- Entrance of each step: a 6px rise and a 4px blur clearing, 320ms, `cubic-bezier(0.22, 1, 0.36, 1)`. Each step animates once, on mount. Steps that mount in the same render (a finished trace on first paint, or a host that sets several at once) stagger 50ms apart in reading order, capped at 8; streamed steps arrive one at a time with no delay.
- Live summary: each new summary rises 6px out of a 3px blur over 260ms. The old one leaves 6px upward over 140ms first (`AnimatePresence mode="wait"`), so the two never overlap in the flow. The summary is the only line that changes while thinking.
- The status dot breathes (opacity 0.45 to 1 over 1.6s, alternating) while thinking, and holds still in dim ink otherwise. Nothing else loops.
- Reduced motion keeps meaning: states still arrive as they happen. Steps, words and the summary use 150ms opacity-only fades. No blur, no rise, no breathing, no fold or grid transition, no smooth scroll.

**Interaction and accessibility**
- The step-count control is a real `button` with `aria-expanded`, `aria-controls` pointing at the trace region, and `aria-label` `"Show reasoning, 5 steps"` (or `"Hide reasoning, …"`). Before the first step it reads `"Show reasoning"` with no count. It is 44px tall on mobile and 36px from `@md`. Hover lifts the pill to 6% ink and brightens the text. Press scales to 0.97 over 150ms. Focus-visible draws a 2px ink ring with a 2px offset, shown at once.
- The reader's click sets their choice in uncontrolled mode, kept across runs unless `rememberChoice` is off. A controlled `open` takes precedence and reports through `onOpenChange`.
- The step list is keyboard scrollable (`tabIndex={0}`) only while it can scroll, with an inset focus ring.
- A visually hidden `role="status"` (`aria-live="polite"`) speaks the first step, then at most one summary every 5 seconds, then `Thought for 2.7s` once the reply starts. It sits outside every busy region: `aria-busy` marks only the step list while thinking and the reply while it streams, never the section, so the polite announcements are not held back. The live summary line itself is not a live region, and it is `aria-hidden` once thinking ends, so the screen reader does not hear every step.
- Decorative dots and chevrons are `aria-hidden`.

**Responsive**
- Works from 320px to 1920px. The root is `@container`, so the card adapts to its column width rather than the viewport. At `@md` the padding and the trace indent step up. Nothing overflows: the summary truncates, the step text wraps, the header stays one line, and the trace caps its height.
- The demo stage is top-anchored (`items-start`, `pt-[15vh]`), so the header does not move as the trace grows and folds. Its resting state is the tallest state, so the preview frame is sized for the whole card.

**Don't**
- No sparkles, brain icons, or "AI" glyphs. No rainbow or purple gradients, no glow, no glass.
- No fake progress bar that pretends to know how long thinking will take.
- No bounce, no rotate-in, no infinite pulse on the content. Only the status dot breathes.
- No lorem ipsum: the trace is about a real billing question with real numbers.
- Do not fold the answer away with the trace. The reply stays on screen.
- Do not run a timeline inside the component. Timing belongs to the host's model; the scripted demo lives only in the default export.
