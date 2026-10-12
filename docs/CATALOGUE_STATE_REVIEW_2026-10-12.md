# Catalogue motion and state review

This is the completed follow-up to the initial showcase review. It covers the catalogue, composed workspaces and landing conveyor, rather than only homepage recordings.

## Published changes

- The landing conveyor includes Wordmark Footer, Waffle Chart, Underline Tabs, Thinking States and Typed Confirm Dialog. Agent Diff Review is removed. Eight of its twenty designs are free.
- Visible conveyor clips play without pointer engagement. Compact, fingerprinted recordings share a bounded decoder budget with the catalogue. Hidden and offscreen media pause; reduced motion and Save-Data use posters. Phones retain a swipeable collection and an explicit preview pause control.
- Animated conveyor rows clip native horizontal scrolling and create enough repeated sets for their viewport. An accelerated geometry regression crosses both wrap boundaries at 5,000px without exposing a gap.
- The homepage booking selector is removed. Its live chart has more room. The lower showcase now presents original music, conversation and meetings workspaces.
- Six existing workspaces use retained application tabs. Sidebar and keyboard navigation change the active view; drafts, selections and scroll positions survive view switches. The report remains a document with normal section navigation.
- Selection surfaces settle precisely under fractional scaling. Removing an active tooltip trigger closes it without opening a neighbour under a stationary pointer; the preview starts with a pinned tooltip so tuning controls are visible.
- Changing catalogue counts, KPI values, chart values, search citations and paywall values continue from their displayed value in either direction. New collection, reaction and participant counts do the same. Direct audio seeking follows the user immediately.

## Reusable components and blocks

Four new primitives support three original composed workspaces:

| Primitive | Useful states and behavior |
| --- | --- |
| Audio Player and Audio Transport | Standalone cover layout and compact footer; actual media playback, seeking, speed, repeat, mute and volume; loading, failed sources, missing sources, artwork fallback and browser gesture restrictions |
| Music Track List | Selected and playing state, independent likes and queue actions, changing counts, contextual collection/search/queue empty states |
| Team Message List | Grouped authors, reactions, threads, anchored scrolling, unread arrivals and an empty conversation |
| Call Stage and Call Controls | Grid and spotlight views, short and large rooms, bounded captions, camera-off and missing/ended host streams, unavailable controls and theme-aware surfaces |

Side A composes the shell, scoped search, collection and real transport. Common room composes conversations, mention input and retained threads. Roundtable composes an agenda, call stage, persistent controls and working notes. Their demos use fictional people and original offline artwork/audio. Hosts own persistence, licensed media, signalling, media permissions and delivery callbacks.

The pinned-room defect was reproduced: an implicit grid row could be shorter than its tile, and positional projection could overlap the enlarged participant. Grid tracks now respect tile minimums, secondary participants scroll within the room, and captions have a bounded region. Tile entry and control feedback retain motion while layout geometry stays valid. Empty streams and explicitly stopped tracks return to camera-off presentation without stopping host-owned tracks.

## Site-wide recordings

The initial pass refreshed 55 existing recordings. This pass replaces the remaining 193 older recordings and adds seven new previews. All 255 committed MP4s are encoded at 60fps, with matching opening-frame posters. Nominal frame rate is supplemented by capture timestamp checks; it is not itself evidence of smooth motion.

All 193 committed replacements were compared byte-for-byte with their accepted captures. Of these, 171 have continuous pointer-motion windows. Their worst p95 captured frame gap is 33.80ms, the largest observed gap is 59.55ms, and none has a continuous-motion gap over 100ms. The other 22 contain intentional static, typing or reading intervals and are not classified as dropped-frame motion from those pauses. Rejected recordings are retried while preserving the last good published asset.

Wallet Card Stack was recorded from the published component, preserving unrelated local source work. Its continuous-motion p95 is 19.93ms and maximum gap is 24.49ms. The recorder also handles moving hover targets and partially visible controls, preserves millisecond image timestamps and avoids processing invisible padding.

## Temporal and behavioral evidence

| Check | Before | After |
| --- | --- | --- |
| Conveyor playback without hover | 0 active clips | 7 active clips; main continuing clips advance about 240 frames over four seconds |
| Wide conveyor geometry | Gaps up to 5,438px, with native scroll offsets | 0 exposed gap and 0 native scroll offset across both wrap boundaries |
| Decreasing catalogue count | Snaps from 244 to 10 | Intermediate descending values; reversals continue from the displayed value |
| Empty collaboration data | Message and call components throw | Both render considered empty states; duplicate instances remain independent |
| Pointer-focus continuation | Keyboard selection remains on the old option in the forced failure | Restores the pressed control; negative control reproduces the failure |

The final local conveyor playback probe recorded a 18.2ms p95 animation-frame gap, 18.4ms maximum gap and no long tasks in its four-second measurement window. Some decoded frames drop at entry and exit; this is not a claim of perfectly locked playback on every device. Aborting media requests fails the ordinary autoplay guard. Pause, reduced-motion activation and restoration are also checked.

These are capture, playback and geometry measurements. Input-to-paint, second-frame input latency and React commit timings are not measured by this review. Geometry acceleration is a boundary regression, not a real-speed benchmark. There was no previous archived case with which to compare this follow-up.

## Verification

- Strict registry generation: 100 free and 159 Pro entries.
- TypeScript and the 934-test, 39-file unit suite pass.
- Visual/a11y sweep: 259 of 259 entries pass after rechecks. Coverage includes desktop widths from 320 to 1,920px, coarse-pointer layouts, available themes, duplicate IDs, horizontal bounds and reduced motion.
- Data contracts: all 246 web components pass two-instance checks and 509 empty-array cases. Native empty-data coverage is included in the browser suites.
- Meeting states: 58 layouts, including 0, 1, 2, 4, 6 and 12 participants, pinned views, long captions and short rooms; empty and ended video streams.
- Audio states: actual playback, pause retention, keyboard seeking in both directions, speed across source changes, mute/restore, failure/recovery, artwork fallback, natural queue advance and no-source presentation. Both layouts and themes fit four viewport sizes.
- Browser regression coverage: 54 suites. The complete run passed 52; the tooltip and fractional-selection failures were fixed and rechecked separately, including tooltip integration. This records combined coverage after fixes rather than describing the earlier run as green.
- Production build: 1,198 pages generated successfully.
- Workspace behavior: retained drafts and notes, failed sends and joins, late acknowledgements, thread focus restoration, persistent room controls and audio across views.

Evidence remains outside the public repository at `/Users/richardawoyemi/ai-prototypes/chit-chat/output/design-autoplay-20261012/`. The rollup, accepted capture reports, before/after replays, negative controls and screenshots are retained there. Pro implementations remain exclusively in the private repository; public commits contain metadata, integration tests and previews.
