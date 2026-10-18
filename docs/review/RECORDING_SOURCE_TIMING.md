# Source timing in catalogue recordings

The damage-driven Chrome screencast can omit an image while DOM attributes keep changing. Branch Compare reproduced this with its resolved meter: width changes from 83.3316% to 83.3333% were below layout precision, so the picture had already settled. Native Web Animations also committed final inline opacity/filter values after presenting those values. Requiring a later screencast image then reported a 427ms delay even though the completed receipt was already visible in the images on both sides of the gap.

`source-screenshots.mjs` requests a real `Page.captureScreenshot` image when the owned screencast has been quiet for 60ms and its source has changed since the last covered frame. Normal frame arrivals cancel unnecessary requests. Unchanged reading holds trigger no screenshots. Capture failures reject the candidate; shutdown waits for an image already requested.

The actual returned JPEG enters the frame sequence. No source mutations are omitted, no UI is altered and no frames are invented. Source cadence still rejects gaps over 100ms, changed-source delivery still rejects delays over 100ms, and the moving-frame limits are unchanged.

An image is exposed between its request and response. It can only acknowledge source changes made before its request, and its delivery delay includes the full time to its response. A later source change must wait for another eligible image. If a normal frame arrives sooner, that frame supplies the earlier acknowledgement. The timing tests cover both cases.

## Verification on 18 October 2026

| Replay | Maximum source gap | Maximum changed-source delay | Moving-frame p95 |
| --- | ---: | ---: | ---: |
| Branch Compare before | 13ms | 427ms, rejected | 19ms |
| Branch Compare with production fallback | 13ms | 80ms | 18ms |
| Asset Licence Sheet, fresh production capture | 12ms | 21ms | 18ms |

Branch Compare used one fresh screenshot. Asset Licence Sheet needed none. The latter's earlier 172ms source gap was not reproduced; the source guard remains enabled and its earlier rejection is preserved.

The same Branch Compare replay with a deliberate 220ms UI block failed both before and after the fallback (231ms and 239ms source gaps). Delaying both capture paths for 220ms also failed: its source stayed live at a 14ms maximum gap while changed-source delivery took 218ms. Raw JSON, diagnostic films and images are kept under the ignored `test-results/handoff-next/source-timing/` directory.

The registered, public `recording-source-probe.mjs` independently reproduces a quiet-frame failure, verifies the real-image fallback, and requires rejection of a blocked UI and a delayed capture stream. Its fixtures contain no private component source. Unit tests cover request/response ordering, native-frame races, capture failure and shutdown.

```sh
node tests/browser/recording-source-probe.mjs
npx vitest run tests/source-screenshots.test.ts tests/recording-quality.test.ts
node scripts/record-demos.mjs editor-branch-compare --base=http://localhost:3100 --isolated-source --frame-viewport --web-height=900 --out=test-results/candidates --report=test-results/candidates/reports --sheet=test-results/candidates/sheets
```

Review the contact sheet and final frame before replacing a catalogue film. Keep the settled Next poster; a recorder's opening-frame poster can include transient hover or entrance state.
