# A component-led homepage

12 October 2026

The owner identified a mismatch: the landing page devoted most of its attention to explaining a design library rather than showing the designs. The new page makes the work the evidence, with short copy around it.

The reference review covered [21st.dev](https://21st.dev/) and [UIArc](https://uiarc.dev/). The useful ideas were a browsable visual catalogue and examples with real interaction. The site keeps its own monochrome identity, type system and restrained orange accent.

## What changed

- A short, split introduction leads straight into a curated mosaic. A large featured design anchors smaller examples from product UI, marketing, data, 3D and native screens.
- The library's segmented control lets readers switch among Selected, Product UI, Marketing and Native collections without leaving the page. Each design opens its actual component page, with its current name and tier from registry metadata.
- The gallery uses existing public posters and recordings. Visibility-based playback shares the gallery's decoder budget. Recordings have a pause control; reduced motion and Save-Data retain posters.
- The next section embeds the actual Portfolio Chart and Booking Slot Selector. Readers can change the chart period and select a day/time before opening a component page or copying an install command.
- Complete-block previews demonstrate whole workflows. The long category-description grid, separate format-explanation cards and large simulated agent terminal have been replaced by a short agent setup section, pricing entry and FAQ.
- The Markdown companion now mentions the block catalogue. The CSS source allowlist includes the newly embedded booking component and drops the old pixel/WebGL showcase sources.

The Design for AI MCP was used to search hero/showcase candidates and retrieve the Marquee Screens brief and Booking Slot Selector contract. The marquee's decorative, hidden screen band did not fit a clickable catalogue, so this page uses its own accessible gallery composition. The segmented control and live demos are the library's actual components, not recreated screenshots of third-party UI. Pro source remains private; the gallery uses already-public preview media.

## Verification

- TypeScript and production build passed; 1,184 pages generated.
- All 913 tests passed across 35 test files.
- Strict registry validation passed for 252 entries in dry-run mode, preserving existing local manifest edits.
- Checked 320, 390, 768, 1024, 1440 and 1920px; document width matched viewport width.
- Tested collection selection with mouse and arrow/Home keys, native and marketing collections, pause removing loaded video sources, chart period changes, booking selection and the empty-day state.
- Visual inspection caught missing booking styles. Adding its source to the stylesheet allowlist restored white surfaces and dark text before release.
- Screenshots and build/deployment logs are saved locally in `chit-chat/output/design-homepage-20261012/`. Final captures include `desktop-1440-final.png`, `phone-390-final.png` and `tablet-768.png`.

Implementation commit: `79e9ef0`. Unrelated component, preview and private-repository edits were preserved.
