# Mobile revision brief (round 2): Design for AI

You are revising existing React Native components for **Design for AI** (design.yaps.ai), a premium, paid component library. Read `MOBILE_BRIEF.md` in the same folder first: every rule there still holds (allowed libraries, glass done right, springs, reduced motion, accessibility, one focused component, the dev loop). Then read the updated sections of `docs/COMPONENT_SPEC.md`: "Monochrome first" and "Polish the whole frame, not just the subject".

The owner reviewed the first round and set two rules for the whole library, in their words:

> "I would expect most things to be relatively monochromatic, using blacks and whites and greys, because we want them to be general components that people can customise. That doesn't mean I don't expect them to occasionally have feature colours, strong contrasted colours that represent the brand colour or a particular card colour. I would usually lean towards monochromatic colours except where intentionally diverging for a very specific part of the component."

> "If you look at the glass tab bar, even though you're trying to focus on the tab bar, everything needs to be polished. Everything around it needs to be polished. When you're on the home tab, I would have expected the charts and everything to animate in in a really nice and smooth way. I would have expected all of the different component blocks to stagger in, maybe from a blur, even with a little bit of blur on the numbers as well, and the numbers to animate up and in, going from zeros to whatever. A similar thing with the charts to animate in and the component pieces to animate in on the Routes tab. And the progress bars to fill in after the components have staggered and animated in on the Club tab. And a similar thing on the You tab, even with the circle around the profile picture to have animated in using path animation. That's how clean I want every single bit to be. Everything needs to be polished, absolutely everything."

## Your job, per component

Revise in place: keep the slug, tier, core idea and what already works (the signature interactions were reviewed and liked). This is not a rebuild unless the colour pass demands a new look.

1. **Colour pass, monochrome first.** Default to black/near-black, white and neutral greys (pick one neutral family; true neutral, not tinted). Keep colour only where it carries meaning: ONE brand accent (primary action, selection, the hero metric), the colour of a depicted thing (a payment card face, album art, activity rings, a map route, a wallpaper), data series, semantic states. Remove decorative colour: rainbow icon tiles become monochrome tiles (glyph and tile in greys, maybe the accent on one), multi-hue avatars become greyscale, tinted full-screen washes become neutral, coloured section backgrounds go. Make the accent a single constant/prop (e.g. `accent`) so one change rebrands it. Glass and texture stay: monochrome is not flat; use luminance, grain, hairlines and depth instead of hue.
2. **Choreograph the whole frame, on every view.** Every tab, step, page, state and screen the component can show gets an entrance:
   - blocks stagger in, in reading order: opacity 0→1, 8–16pt rise, and a soft blur that clears (on RN use a blur look you can actually render: e.g. a `BlurView` overlay on the block whose intensity animates down, or scale 0.98→1 + opacity if blur is impractical for that block; check what renders on web);
   - numbers count up from 0 (first view) or from their previous value (changes), tabular, with a slight blur/opacity settle as they land;
   - charts draw: line paths stroke in (strokeDashoffset), bars grow from the baseline, rings draw along their path, sparklines draw left to right;
   - progress bars and meters fill after their block has landed;
   - avatar rings, badges and icons draw or pop in last, with at most one small overshoot;
   - order: containers, text, figures, data, progress. 40–70ms stagger, whole sequence under ~900ms, interruptible (switching away mid-sequence must not glitch);
   - switching back to a tab re-plays a lighter version (or the full one; your call, but it must never pop in unanimated).
   Context content (the dashboard behind a tab bar, the page behind a sheet, the list behind a header) is held to exactly the same bar as the subject.
3. **Find and fix anything else that falls short**: dead or static areas, anything that cuts, text that pops, unpolished secondary views ("lighter context screens" are no longer acceptable: every view must be finished and beautiful).
4. Respect reduced motion: entrances become short fades; numbers set instantly.
5. Update `prompt.md`, `prompt.json` and `meta.json` (description ≤170 chars, tags) to match, including the colour approach and the entrance choreography so an agent rebuilding from the prompt reproduces them.

## Verify
For each view, capture: the settled state, and 2–3 mid-entrance frames (use Playwright's `page.clock` to pause and step time, as round 1 did). Look at every screenshot at 2x like a demanding Apple designer. Check reduced motion, and 360/430pt widths. `node scripts/build-registry.mjs --strict`, `npx tsc --noEmit`, `npx vitest run tests/registry.test.ts`, no console errors.

Known react-native-web gotchas from round 1:
- An Animated animation started in the same tick a view mounts can stall: start it from a mount effect (one frame later) or keep the view mounted.
- An Svg next to an absolutely positioned layer may render beneath it: wrap the Svg in a View.
- A parent with opacity < 1 cuts a child `BlurView` off from its backdrop on web; fade glass layers individually.
- A `BlurView` stops blurring in Chromium if an ancestor keeps a transform after its spring ends (even identity); drop the transform at rest.
- Interpolations rebuilt every render can stall animations; memoise them.
- Animating SVG paths can produce a `collapsable` prop console error; filter that prop in a wrapper.

## Rules
Only touch your own slug folders. Don't touch site code, package.json, git, or other components. Don't commit. Don't start or stop servers (dev server: http://localhost:3100). Scratch dir: `<scratch>/<your-agent-name>/` — never write screenshots into the repo.

## Report back
Per component: what changed in colour (before → after), the entrance choreography for each view, what else you fixed, compromises, and paths to final 390×844 @2x screenshots: settled state of every view plus a contact sheet of mid-entrance frames.

## Added by the owner after this brief was written
> "The feedback I gave for the glass tab bar is representative of how polished I want everything to be across the board. I don't want you to just focus on that specific thing. I want you to pay close attention to everything. I want all of our code to be brilliant. And even though I want it to be monochromatic, I do want us to be dark-theme leaning, naturally."

- **Dark first:** default to a dark theme. Light-default components become dark (or gain a `theme` prop with dark as the default and light kept polished too).
- **Brilliant code:** see "Write brilliant code" in docs/COMPONENT_SPEC.md: small named sub-components and hooks, tokens in one place, memoised animated values, no dead code, named constants, effects that clean up, comments that explain why. Refactor what you touch so the file reads beautifully.
- **Everything:** the tab-bar feedback is an example of the standard, not a checklist. Scrutinise every pixel, state and transition of your components.
