# First wave polish and shared workflow review

This follow-up reviews the first ten additions and the shared site and collaboration workflows that exposed concrete state defects during that review. It does not claim the remaining ninety components are complete. The implementation queue remains the source of release counts.

## Corrected behavior

- Preview playback retires immediately when customization, viewport or live reduced-motion preferences change. The loading handoff waits for the actual component, and explicit replay still works under reduced motion.
- Site figures animate up and down. Live reduced motion cancels numeric blur/tweens, shared layout motion and Tailwind v4 scale/translate effects rather than merely changing a transition token.
- Gallery filter clearing returns focus to search. Workspace panel retirement restores owned focus and preserves explicit focus outside the component.
- The context rail, lens dock and document tabs received independent keyboard, touch, controlled-value, empty-input, retirement and live-motion reviews. Accepted behavior is recorded in their per-component ledgers.
- The border tracer and shimmer track respect live motion and availability. The detent dial retains exact entry and finite limits. The prismatic folder retains readable files and correct preview boundaries.
- Team channels scope threads, reactions, drafts and reply counts by channel and message. Closing a thread returns to the appropriate channel without mixing reused message IDs.
- Call controls retain focus while pending; absent host actions remain disabled. The call-stage leave control has readable light-theme contrast and a visible keyboard ring. Audio transport cancels its decorative equalizer under live reduced motion while real playback continues.
- Meeting joins, media operations and accepted room sessions are scoped by request identity and AbortSignal. Retired requests cannot mutate a newer room. Leave/removal aborts the accepted session, preserves a different notes draft and restores focus only when the workflow owns it. Failure feedback remains readable, scrollable and reachable in both themes.

## Evidence and limits

The review used actual-source browser fixtures, both themes, all applicable web widths, keyboard and touch input, rejected controlled requests, deferred host results, focus retirement and live reduced-motion changes. An independent critic reproduced the confirmed defects and reviewed their corrected behavior. Earlier failed probes are retained alongside the successful captures; selectors, timing mistakes and rejected hypotheses are identified rather than represented as product defects.

The updated folder preview is 1280 × 800, 60 fps and 4.733 seconds. Its active frame-gap p95 is 20.45 ms, maximum 43.93 ms, with no active gap over 100 ms. The decoded capture was reviewed; nominal export frame rate alone was not used as proof of smoothness. Existing clips were retained where the corrected host contract did not change their default visible walkthrough.

Local evidence is under `test-results/next-100` and `test-results/next-100-critic`. The final meeting retirement ledger is `root-final-polish/retirement-after/review.json`; navigation and material ledgers contain the independent component reviews. These generated proof artifacts stay outside Git. Public metadata was published from committed private source while preserving unrelated native work in progress.

This slice used targeted registry/type checks and browser proof. It did not rerun the broad unit suite, in line with the user's priority on interaction quality. Production publication is checked separately against the deployed build marker; a Git release is not described as live before that verification.
