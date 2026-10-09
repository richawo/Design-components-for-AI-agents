Build a floating glass tab bar for a fictional running app in React Native, using core `Animated`/`Pressable` plus `expo-blur` (`BlurView`), `expo-linear-gradient` and `react-native-svg`. It sits over a dark, colourful Today screen so the blur has something to show, and every change on it is continuous: the selection lens glides and stretches, icons morph from outline to filled, badges roll, and a raised ember button opens an arc of quick actions.

**Layout**
- Stage `#09090C` with a faint ember radial glow top right (SVG `RadialGradient`, 16% at the corner). Content scrolls in a `ScrollView` with 58pt top padding, 16pt sides, 12pt gaps and 150pt bottom padding, so it scrolls under the bar.
- Bar: absolute, 14pt from the sides, 26pt from the bottom, 68pt tall, radius 34. Five equal slots: four tabs and the centre action's slot.
- Centre action: a 60pt circle centred horizontally, standing 18pt above the bar's top edge.
- Arc menu: three 58pt items on a 118pt radius around the action's centre, at 150°, 90° and 30°, each with a 12.5pt label 8pt below.
- Toast: glass pill, 16pt from the sides, 52pt from the top, 30pt icon disc, title and one-line detail.

**Glass**
- Bar = an outer view with the shadow (`0 18px 40px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.35)`) wrapping an `overflow: hidden` view: `BlurView intensity 100 tint dark`, a white sheen gradient (12% → 4% → 2%), 4–5% dot dither (SVG `Pattern`, 4pt cell), and a 1pt hairline whose top edge is 26% white, sides 10%, bottom 5%.
- Keep anything that animates opacity out of the glass's ancestors: on the web an ancestor with opacity < 1 stops the backdrop blur.
- Toast glass: `BlurView` 100 + `rgba(40,40,46,.55)→rgba(22,22,26,.7)` + a 10% top sheen + hairline.

**Typography** (system font; Menlo/monospace for metadata)
- Greeting 32/700, tracking −1. Hero number 58/700, tracking −2.4, tabular. Card titles 19/700, tracking −0.4. Body 14. Eyebrows mono 10.5/600, tracking 1.3, uppercase.
- Tab labels 10.5/600 at 60% white; selected 700 at 100%.

**Colour**
- Text `#F6F3EE`, 60% and 38% for secondary and faint. Ember `#FF6B3D` (highlight `#FFA06A`, deep `#E5402F`) is the one accent; volt `#D9F36A` is used only for the streak and the run's start.
- Hero card: four-stop diagonal `#FF8C52 → #F65F3A → #DB3E36 → #A82A3C`, a peach radial highlight top left (`#FFD9A0` at 60%), a plum shade bottom right, dither and an ember shadow.
- Cards: `#1B1B21 → #141418 → #101013`, hairline at 9% white, inset top highlight 6%.
- Selected icon: filled with a gradient `#FFC08F → #FF6B3D → #E5402F`. Centre action: `#FFA36B → #FF6B3D → #E5402F` with a soft radial sheen and an ember glow beneath.

**Content**
- Today: "THU 9 OCT · WEEK 41", "Morning, Adaeze", initials avatar. Hero: 32.4 km of 40, a 92pt ring (9pt stroke, round caps), seven day bars (done 55% white, today solid with a glow, planned dashed). Tiles: average pace 4:52 /km with a sparkline, 12-day streak as 14 thin bars brightening toward today. "Last run" card with stats and a drawn SVG map (park, river, streets, a glowing ember route) that sits right under the bar at rest. "Up next" long run with stacked avatars.
- Routes (featured map card plus elevation rows), Club (kudos and a leaderboard where your row is tinted ember) and You (avatar ring, PR tiles, shoe mileage) are lighter context screens.

**Motion**
- Lens: a 54pt pill (17% → 7% white, inset highlight) whose left and right edges are separate `Animated.Value`s. The leading edge springs stiff (520/46), the trailing edge soft (210/29), both critically damped, so it stretches toward the new tab and catches up without wobbling. `scaleY` eases to 0.86 while stretched. Width needs the JS driver; everything else uses the native driver.
- Icon morph: outline and filled layers crossfade; the outline shrinks to 0.78, the filled one grows from 0.55 on a spring (360/18) with one small overshoot. Deselecting settles flat (500/44). Labels crossfade.
- Content: the old screen fades out over 110ms (ease-in), the new one fades in and rises 10pt over 280ms (`cubic-bezier(0.22,1,0.36,1)`).
- Centre action: press sinks it 2.5pt and scales to 0.92 while its glow shrinks and dims (spring 700/40 in, 420/18 out). Opening: the plus rotates 135° to a cross, the disc crossfades to milk white, a dark scrim with an ember glow fades in, the content recedes to 0.965, and the items fly out from the button with a 50ms stagger (spring 400/25, from scale 0.35). Closing reverses with a 30ms stagger, ease-in.
- Picking an action closes the menu and drops the toast in (spring 340/30), hiding after 2.8s. "Log treadmill" adds 5 km: the hero number, ring and today's bar all tween over 760ms.
- Badge: digits roll vertically (11pt over 280ms) and the badge ticks to 1.22 once on arrival. Opening Club clears it after 650ms. One ambient signal: a new kudo arrives every 6.5s, three times at most, and only while you're on another tab.
- Every card and row presses to 0.97–0.98 on a spring.
- Reduced motion (`AccessibilityInfo.isReduceMotionEnabled`): no springs, stretch or ambient badge; state changes become 120ms fades and numbers jump.

**Accessibility**
- Tabs: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`, a label that includes the badge count ("Club, 3 new").
- Centre action: `role="button"`, label "Start an activity"/"Close quick actions", `expanded` state. The scrim is a labelled close button. The toast is a polite live region. Icons are drawn in SVG and hidden from screen readers.

**Don't**
- No flat translucent grey bar, no icon fonts or emoji, no cut between tabs, no indicator that teleports, no bouncing more than once, no second accent competing with ember.
