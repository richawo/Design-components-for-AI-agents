Build a working indicator for an AI reply in React + Tailwind CSS (v4), using `motion/react` for the label cross-fade and the entrance. It should read as honest work in progress: the system says what it is doing, in plain words, and the indicator only moves to show that something is running. Monochrome, quiet, sized to sit inline in a sentence or inside a button. No sparkles, no orbiting gradients, no percentages it cannot know.

**Layout**
- The component is one inline root span: `inline-flex`, `items-center`, `align-middle`, `max-w-full`. Do not make it a container query: `@container` gives an inline box an intrinsic width of zero. Gap 10px in md, 8px in sm. When a glyph is present (matrix or steps), add a leading inset of 0.5em on the root so the glyph does not sit against the full stop before it.
- Three variants share one label. `shimmer` has no glyph: the label is the indicator. `matrix` puts a 3×3 grid before the label, 18px square in md (4px dots, 3px pitch) and 13px in sm (3px dots, 2px pitch). `steps` puts three short ticks before the label, 2px wide and 8px tall in md, 2px by 7px in sm, separated by 4px in md and 3px in sm. The ticks are centred on the label's x-height.
- Reserved width: the root takes a `reserve` list of every state it will show. Each reserved state is rendered invisibly in the same grid cell as the live label, so the width is set by the widest state and never follows the label while it cycles. A button or sentence around the indicator therefore never resizes. A label outside the list still renders, but the width then follows it.
- The label sits in an inline grid with one cell, so the old and new text overlap while they cross-fade and the line never reflows. The label wraps inside its parent rather than truncating, so no words are ever cut off.

**Typography**
- Label: Geist (font-sans) 500, tracking −0.01em, 15px / 24px in md, 13px / 20px in sm.
- Shimmer text uses the same size and weight. Matrix and steps labels use the body colour.

**Colour** (one palette per theme, written to CSS variables on the root)
- Dark: ink `#f4f4f5` (the lit dot, the comet head and the shimmer highlight), body `#c6c6cc` (settled label and the tick glyph), base `#8a8a93` (shimmer resting text, about 5.6:1 on `#0e0e10`, and the comet tail), rest `#45454d` (unlit dots).
- Light: ink `#18181b`, body `#3f3f46`, base `#71717a` (about 4.8:1 on white), rest `#c4c4ca`.
- No accent. Greyscale only. Nothing in the glyph is brighter than the body text.

**Motion** (one `CYCLE_MS` table: shimmer 2200ms, matrix 1200ms, steps 1500ms. `speed` is applied as a playback rate on the running loops, never by editing the cycle, so a change of tempo keeps every element at its place in its loop.)
- Shimmer: a 50% highlight band, 20% of the text width, sweeps left to right across the label, linear, looping. It is `background-clip: text` on the label only, so the band never leaves the glyphs.
- Matrix: the eight outer cells light clockwise in order. Each cell runs a three-step comet: ink at 18% of the loop, body at 30%, base at 42%, back to rest by 50%, so the sequence reads as a direction. The centre lights halfway round, at phase 0.5. `ease-in-out`.
- Steps: three ticks light one at a time, each brightening to full body colour for about a sixth of the loop and falling back to 28% opacity, staggered by a third of the loop. No fill, no left-to-right sweep, no total.
- Each element starts at a negative delay of `(phase − 1) × cycle`, so nothing waits on mount and the phase offsets hold for the life of the loop.
- `paused` sets `animation-play-state: paused` on every loop through a root variable, freezing the current frame.
- Label change: the outgoing label blurs 3px and moves up 4px over 160ms (ease-in). The incoming one arrives from 4px below with the same blur over 260ms (ease-out).
- Reduced motion: no loops at all. The shimmer shows the base colour only, the matrix shows its top row as a still comet (ink, body, base), the steps show the first tick at full opacity and the other two at 35%. The label cross-fades in 150ms with no offset or blur.

**Keyframes** are injected once per document with a `<style href="ats-thinking-states" precedence="default">` tag, so two instances on a page share one block.

**Accessibility**
- The visual indicator is `aria-hidden`. The label is repeated in one visually hidden `role="status"` region, so assistive tech announces each state once, politely.
- Nothing in the indicator is interactive. Inside a button, the button carries its own visible name (for example "Stop") and the indicator sits beside it, not inside it, so the name and the content agree.
- Any control in the surrounding UI keeps a touch target of at least 44px tall below 640px wide, and 36px above it.

**Demo** (the default export): a 540px reply card with a meta line, a paragraph whose last words are the indicator, a hairline, and a footer with a short note and a Stop button. The button toggles to Resume. Stopped, the inline indicator is replaced by a still "Stopped · draft kept" line and the footer note says Resume picks up from this point. A three-option switch below the card selects the variant. The phase label holds on "Reading files…" until the first variant pick, so every run opens on it. Each pick then advances the label and restarts a 2400ms timer that keeps advancing it while the reply runs.

**Don't**
- No percentage, count-up or progress fill that implies a known total. A label that says "Searching 12 sources…" is the honest form.
- No sparkle icons, gradient halos, orbiting rings or bouncing dots.
- No colour beyond the greyscale ink. No pill or badge around the label.
- No ellipsis animation, typing cursor or looping text swap that never ends on a state.
- No dead controls: a button that looks like it stops something must stop it, and its visible text must match its accessible name.
