Build a floating glass tab bar for a fictional running app in React Native, using core `Animated`/`Pressable` plus `expo-blur` (`BlurView`), `expo-linear-gradient` and `react-native-svg`. The whole frame is monochrome (true black, neutral greys, white ink) with one accent, ember `#FF6B3D`, kept for the centre action, the selected tab and the week's hero metric. Every tab (Today, Routes, Club, You) is a finished screen with its own entrance choreography: blocks blur in, numbers count up, charts and routes draw, bars fill. Every change on the bar is continuous: the lens glides and stretches, icons morph from outline to filled, badges roll, and the raised button opens an arc of quick actions.

**Layout**
- Stage `#0A0A0A` with a faint neutral glow top right (SVG `RadialGradient`, white at 6%). Content scrolls in a `ScrollView` with 58pt top padding, 16pt sides, 12pt gaps and 150pt bottom padding, so it runs under the bar.
- Bar: absolute, 14pt from the sides, 26pt from the bottom, 68pt tall, radius 34. Five equal slots: four tabs and the centre action's slot.
- Centre action: a 60pt circle centred horizontally, standing 18pt above the bar's top edge.
- Arc menu: three 58pt items on a 118pt radius around the action's centre, at 150°, 90° and 30°, each with a 12.5pt label 8pt below.
- Toast: glass pill, 16pt from the sides, 52pt from the top, 30pt icon disc, title and one-line detail.

**Screens**
- Today: mono date line and "Morning, Adaeze" with an initials avatar. Hero card (radius 28): "THIS WEEK" 32.4 km of 40 with "7.6 to go", a 92pt progress ring (9pt stroke, ember), seven day bars (done 30% white, today ember with a soft glow, planned dashed outlines). Two tiles: average pace 4:52 /km with a white sparkline (area fading under it, end dot), and a 12-day streak as 14 thin bars brightening toward today. "Last run" card with four stats and a drawn greyscale street map (park, river, streets) with the route as a white line. "Up next" long run with stacked avatars.
- Routes: a featured map card (Hackney Marshes loop, 10.2 km, 18 m climb, ~52 min) with a single marker where the loop closes, then "SAVED NEARBY": four rows, each with a drawn route thumbnail, name, one-line facts and an elevation sparkline (52pt wide under 380pt, 76pt above).
- Club: October club goal 1,846 / 2,500 km with a 6pt white progress bar, a kudos card with three stacked greyscale avatars (ringed in the card colour, overlapping 20% so initials stay legible), and a five-row weekly leaderboard with thin bars; your row is lifted with a 5% white tint and a solid white bar.
- You: an 84pt avatar with an ember ring for the year goal (1,284 of 1,500 km) and an 86% pill, a three-up year stats strip, four personal-best tiles, and shoe mileage with an 8pt bar.

**Glass**
- Bar = an outer view with the shadow (`0 18px 40px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.35)`) wrapping an `overflow: hidden` view: `BlurView intensity 100 tint dark`, a white sheen (12% → 4% → 2%), 5% dot dither (SVG `Pattern`, 4pt cell), and a 1pt hairline 26% white on top, 10% on the sides, 5% at the bottom.
- Lens: a pill inset 5pt in its slot, white 17% → 7% with an inset top highlight.
- Toast: `BlurView` 100 + `rgba(40,40,40,.55)→rgba(22,22,22,.7)` + a 10% top sheen + a 16% hairline.
- Never animate opacity on a glass layer's ancestor (on the web it cuts the `BlurView` off from its backdrop) and drop transforms at rest.

**Typography** (system font; Menlo/monospace for metadata)
- Greeting and screen titles 32/700, tracking −1. Hero number 58/700, tracking −2.4, tabular. Tile numbers 28/700. Card titles 19/700, tracking −0.4. Body 14. Eyebrows mono 10.5/600, tracking 1.3, uppercase.
- Tab labels 10.5/600 at 60% white; selected 700 at 100%.

**Colour**
- One neutral family: background `#0A0A0A`, text `#F5F5F5`, secondary 64%, faint 50%, hairlines and tracks 8% white. Cards `#1A1A1A → #141414 → #101010` with a 9% hairline and an inset 6% top highlight; the hero card `#202020 → #111111` with a white glow top left and a faint ember glow behind the ring.
- Accent: one `accent` prop (default ember `#FF6B3D`), used only for the centre action (with a top sheen and an accent-tinted shadow), the selected tab icon, the week ring, today's bar and the You ring. Everything else is white or grey: routes, sparklines, streak, progress bars, badges (white with black digits) and the arc items (milk white `#FFFFFF → #D6D6D6` with black glyphs).
- Avatars are greyscale gradients; your own is inverted (white with black initials) so it reads first.

**Entrance choreography** (every tab, every time it is shown)
- Blocks arrive in reading order: each block fades in, rises 12pt and clears an 8px blur over 520ms (`cubic-bezier(0.22,1,0.36,1)`), 55ms apart; rows inside a list follow 45ms apart. On iOS, where CSS blur doesn't render, blocks settle from scale 0.98 instead.
- Figures start 150ms after their block: numbers count up from zero over 680ms (tabular) while a 5px blur clears and their opacity settles; lines, routes and rings draw along their path (`strokeDashoffset`, 680–800ms); the sparkline's area fades in behind its stroke so it never runs ahead of the line; day bars and streak bars grow from the baseline with a 30ms stagger; end dots and avatars pop in last with one small overshoot (spring 400/28).
- Progress bars fill 300ms after their block lands (520ms). Containers come first, then text, figures, data and progress; the whole sequence ends inside ~900ms.
- Switching tabs: the old view fades, lifts 6pt and blurs out over 130ms (ease-in), then the new view mounts and replays its full entrance. A second tap mid-exit just retargets, so nothing stacks or glitches.
- Later changes (a logged run) tween from the previous value over 640ms with a half blur.

**Motion**
- Lens: its left and right edges are separate `Animated.Value`s. The leading edge springs stiff (520/46), the trailing edge soft (210/29), both critically damped, so it stretches toward the new tab and catches up without wobbling; `scaleY` eases to 0.86 while stretched.
- Icon morph: outline and filled layers crossfade; the outline shrinks to 0.78, the filled one grows from 0.55 on a spring (360/18) with one small overshoot. Deselecting settles flat (500/44). Labels crossfade.
- Bar entrance: the bar and the centre action rise 36pt into place (spring 260/28) on first view.
- Centre action: press sinks it 2.5pt and scales to 0.92 while its glow shrinks and dims. Opening: the plus rotates 135° to a cross, the disc crossfades to milk white, a dark scrim with a faint accent bloom fades in, the content recedes to 0.965, and the items fly out with a 50ms stagger (spring 400/25, from scale 0.35). Closing reverses with a 30ms stagger, ease-in.
- Picking an action closes the menu and drops the toast in (spring 340/30), hiding after 2.8s. "Log treadmill" adds 5 km: the hero number, ring, "to go" and today's bar tween.
- Badge: digits roll vertically (11pt over 280ms) and tick to 1.22 once on arrival. Opening Club clears it after 650ms. One ambient signal: a new kudo every 6.5s, three at most, only while you're on another tab.
- Cards and rows press to 0.97–0.98 on a spring.
- Reduced motion (`AccessibilityInfo.isReduceMotionEnabled`): entrances become 150ms fades, numbers and charts appear at their values, no springs, stretch or ambient badge.

**Accessibility**
- Tabs: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`, a label that includes the badge count ("Club, 3 new").
- Centre action: `role="button"`, label "Start an activity"/"Close quick actions", `expanded` state. The scrim is a labelled close button. The toast is a polite live region. Charts carry a text label (daily distances, streak). Icons are SVG and hidden from screen readers.

**Don't**
- No colour for decoration: no gradient hero card, no tinted backgrounds, no coloured avatars, no second accent. No flat translucent grey bar, no icon fonts or emoji, no tab content that pops in unanimated, no indicator that teleports, nothing that bounces more than once.
