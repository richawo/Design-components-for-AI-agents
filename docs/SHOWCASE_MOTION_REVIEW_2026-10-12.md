# Initial showcase motion and dark-theme review

This records the first pass. The later [catalogue motion and state review](CATALOGUE_STATE_REVIEW_2026-10-12.md) supersedes the published scope and verification below, including site-wide recording replacements and autoplay without hover.

The landing page now presents two moving collections of real component previews. Cards stop moving under the pointer or keyboard focus. Recordings start at the beginning on entry, including catalogue cards that were already autoplaying. Playback also restarts after the scheduler pauses a card. Mobile, reduced-motion and Save-Data visitors get a stationary, swipeable collection.

## Recording investigation

All 250 existing MP4s were decoded and audited. None had decoding errors. A 30fps label did not establish smooth captured motion: the original recorder used software rendering, acknowledged capture buffers after synchronous disk writes, and rounded JPEG timestamps to a 25Hz input time base.

The recorder now uses native rendering, acknowledges frames immediately, writes asynchronously, preserves millisecond JPEG timestamps and encodes at 60fps. Gallery scripts remove idle lead-ins and shorten the final reading pause while retaining asynchronous interactions and held-button waits. Quality checks preserve the last published asset when capture pacing, duration or file size fails. Continuous pointer motion must have p95 frame gaps of at most 34ms and no isolated gaps over 100ms. Deliberate typing cadence and stationary reading pauses are excluded from that motion guard.

### Sticky Scroll Story reproduction

Same action sequence and viewport, measured from Chrome screencast timestamps:

| Capture | p95 active frame gap | Largest active gap | Gaps over 100ms |
| --- | ---: | ---: | ---: |
| Original software and synchronous capture | 174.39ms | 497.99ms | 11 |
| Native and asynchronous capture, same script | 17.34ms | 111.52ms | 1 |
| Published capture, tightened script and prepositioned first action | 17.32ms | 21.37ms | 0 |

The first two rows isolate the rendering and capture change. The final row additionally changes pacing and starts directly on the story panel. The final conveyor probe had a 16.91ms p95 captured gap and no gaps over 100ms.

The encoder negative control used three frames spaced 10ms apart. The old concat input reported packet times of 0, 0 and 40ms. Explicit millisecond input timing retained 0, 10 and 20ms. Regression tests also show that labeling a sparse capture 60fps cannot repair its missing frames. These are capture and encoding measurements, not input-to-paint or display-refresh measurements. No claim about interaction latency, long tasks or React commit duration follows from them.

## Published scope

29 recordings were refreshed for the homepage collections and important interactions, including Sticky Scroll Story, authentication, AI input and workspace previews. Another 26 formerly light previews were recorded using their existing, purpose-designed dark palettes: eight fashion, eight HR, nine legal and one commerce component. Their posters now match their opening video frame. The complete catalogue's 252 entries, including eight blocks, now advertise a dark default surface. The live booking example on the homepage uses its dark palette too.

The 26 themed production components, default demos, documented prop defaults and theme controls all agree on dark as the default. Explicit light mode remains selectable. No colour inversion or video filter was used. Illustrations, documents, data colours and other content retain their designed colours within the dark interface.

The final 26 dark captures have a worst continuous-motion p95 gap of 27.97ms and no continuous-motion gaps over 100ms. Rejected captures were retried before publication. The remaining original movies were audited, but were not all re-recorded. Existing unrelated mobile and passkey work was preserved and excluded from these commits.

## Verification

- Strict registry generation: 100 free and 152 Pro entries.
- TypeScript: passes.
- Full suite: 922 tests in 37 files pass.
- Production build: 1,184 pages generated successfully.
- Browser review: homepage widths of 320, 390, 768, 1,024, 1,440 and 1,920px, without page overflow; keyboard alignment and pointer navigation; pause control; reduced-motion and native swipe layout.
- Playback: keyboard re-entry reset the homepage preview from 2.46s to 0.17s. A production catalogue card already at 2.55s reset to 0.16s on keyboard entry. The small elapsed values include playback during the observation itself.
- Theme: dark initially selected on the component page; both light and dark controls remain functional. All 26 dark posters were inspected together and their recorded interactions inspected with frame sheets.
- Media: refreshed clips verified as 1,280 by 800, 60fps, within the recorder's duration and size gates. Homepage videos attach only on hover or keyboard engagement, avoiding continuous decoding across the conveyor.

Local evidence is retained outside the repository at `/Users/richardawoyemi/ai-prototypes/chit-chat/output/design-motion-20261012/`: the 250-clip baseline audit, original movies, timestamp reports, encoder controls, frame sheets, responsive screenshots, dark-theme contact sheet and conveyor recording. Private component source changes were committed only to the private Pro repository.
