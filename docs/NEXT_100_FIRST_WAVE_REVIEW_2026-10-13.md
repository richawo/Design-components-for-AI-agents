# First-wave component review

13 October 2026. These are review verdicts, not claims that planned catalogue rows have shipped. Review used the actual component source, isolated real browser interactions, screenshots and decoded recordings. A good default image did not excuse broken controlled, failure or narrow states.

| Component | Verdict | Rejected behavior or presentation, and the correction independently checked |
| --- | --- | --- |
| Shimmer Track | Approved | A controlled reset originally stranded the action and allowed a stale success to win. Reset now aborts the old request, releases the action and ignores its result. A live reduced-motion change now removes the label's movement as well as the edge orbit. Failure, retry and the finished shimmer remain readable without changing geometry. |
| Context Rail | Approved | Switching sections originally moved the whole frame and could mark an uncommitted destination current after rejection. A stable frame and a separate committed destination fix both. Returning to the current destination cancels a pending request. The narrow drawer, error recovery and keyboard focus remain usable. |
| Prismatic Folder | Approved | An externally closed panel originally dropped focus into the page body. It now returns focus to its trigger when it hides the focused panel. Actual file rows, selected preview, failed opening and retry were inspected. The first clip made the object too small, and a later closing stall was rejected before the clean final crop. |
| Detent Dial | Approved | Fine steps produced duplicate detents, large numbers crossed the rim, and a rejected controlled edit lost the user's entered value. Precision validation, a bounded readout and preserved drafts fix those cases. The control now gives physical press feedback while reduced motion stays static. The final clip shows smooth increases and decreases. |
| Lens Dock | Approved | The initial phone layout partially clipped its last tool. All six default hit targets now fit at 320px, and magnification is bounded within the visible cells. Clicking the current tool aborts a pending alternative. Empty and unavailable copy now describes the real state. The final clip shows the magnification and destination change without moving the hit targets. |
| Icon Workbench | Approved | An invalid container query squeezed the phone grid into collisions; it now adapts to the actual container. Buttons and search Enter no longer submit a surrounding host form. The phone grid is bounded so the specimen appears sooner. Failed and stale clipboard operations, selectable output, keyboard glyph selection and the decoded glyph/stroke/format sequence pass. Final recording evidence is in `test-results/next-100/devtools-icon-workbench/isolated-report/`. |
| Signal Workbench | Approved | Phone connectors originally crossed and the empty state left a parameter emphasized. The connector routes now communicate the actual signal path and empty inputs neutralize it. Controlled arrow selection follows focus, narrow embedded headings use container dimensions, and gain zero produces a truly flat plot. The decoded clip demonstrates shape, upward frequency and downward gain. |
| Border Tracer | Approved | The first popup cut abruptly, reduced-motion presses still scaled, and transformed host dimensions could mismeasure the border. Popup transitions now preserve focus and immediate exit inertness; reduced motion is static; fractional layout dimensions survive ancestor scaling. Actual integrated perimeter movement and pause conditions pass. The recorded popup opening with a capture gap was rejected. The final 5.5-second perimeter lap is smooth and its decoded loop boundary preserves the light's phase. |
| Stacked Document Tabs | Approved | Workspace and action resets originally lost keyboard focus; a cached restored document could outlive host availability; a shared hover rule made Retry unreadable; and Close controls broke the tablist's accessible ownership. Focus recovery, authoritative membership, a dedicated primary action and a separate Close group fix these cases. The full selected tab and its Close target remain visible on a narrow container, actual dragging reaches the last slot, failed actions retain drafts, and a background close preserves newer editing. The decoded video cleanly shows reorder, close/restore and native dirty-close review. |
| Split Resizer | Approved | The light grip originally lacked sufficient contrast, inline size observers could cause a render loop, and degenerate geometry could leave hidden content interactive or offer impossible actions. The corrected grip, stable observer reporting and geometry-aware inertness/controls pass. Rejected controlled requests keep actual sizes honest; partial drag acceptance rolls back on Escape; both pane restores retain the draft and useful focus. The default export now honors locked/forced ownership and keeps displayed pixel sizes live with caller observers. The decoded video shows smooth pane movement, real text reflow, figures in both directions and a complete reset. |

All ten foundation components have independent source, state, visual and recording approval. There are no unresolved release blockers within this first wave.

Ten foundation components are approved and pushed. The remaining 90 rows form the implementation queue; they are not completed components.

## Browser and recording checks

Review covered six web widths (320, 390, 768, 1024, 1440 and 1920), both supported themes, keyboard and touch equivalents, multiple instances, empty collections, controlled values and live reduced-motion changes where applicable. Failed and stale host callbacks were exercised directly. Source/type checks and strict registry validation passed. Visual and interaction review took priority over repeated unit runs, as requested.

The final clips are dark, have matching first-frame posters and are encoded at 60 fps. The table reports actual browser capture gaps during actions, rather than inferring smoothness from that encoding rate. Still holds were distinguished from moving intervals; every accepted clip was also inspected after decoding. Border's continuous lap includes every sampled frame.

| Clip | Duration | Capture p95 gap | Largest action gap | Action gaps over 100ms |
| --- | --- | --- | --- | --- |
| `button-shimmer-track` | 4.2s | 21.2ms | 46.6ms | 0 |
| `navigation-context-rail` | 4.6s | 22.5ms | 43.8ms | 0 |
| `navigation-lens-dock` | 3.2s | 24.3ms | 74.3ms | 0 |
| `cards-prismatic-folder` | 4.0s | 20.0ms | 31.9ms | 0 |
| `input-detent-dial` | 4.0s | 24.6ms | 42.4ms | 0 |
| `devtools-icon-workbench` | 3.7s | 21.8ms | 52.9ms | 0 |
| `hero-signal-workbench` | 4.2s | 29.5ms | 64.2ms | 0 |
| `effect-border-tracer` | 5.5s | 17.9ms | 25.9ms | 0 |
| `navigation-stacked-tabs` | 6.0s | 18.3ms | 40.2ms | 0 |
| `layout-split-resizer` | 3.5s | 21.0ms | 34.1ms | 0 |

Early recordings made in a busy development page were rejected. The accepted recordings isolate the checked-out source with production React, retain real preview styling and fonts, and serialize browser work. The recorder now supports this through `--isolated-source`; the normal preview and whole-page capture modes remain available. This removes development instrumentation from a recording, and is distinct from proving a change to deployed UI performance.

For Border, a recording pause was investigated against cold actual UI input. The first popup frame arrived in 59.8ms with no frame gap over 100ms; an injected 160ms blocking control increased it to 224.2ms and was detected. The final gallery lap demonstrates the perimeter effect itself. Popup entry, exit, focus, inertness and reduced motion were reviewed separately.

The evidence is retained locally in ignored `test-results/next-100/` and `test-results/next-100-critic/`. Pro source is committed in the private registry; public commits contain metadata, selection guidance, posters, recordings and this review. See [the 100-component queue](NEXT_100_COMPONENTS_2026-10-13.md) and [the repeatable QA commands](COMPONENT_QA.md).

## Publishing verification

The larger 14-article, 30-language corpus took the earlier Worker to 68,015,528 bytes, above its 64 MiB module limit. Its optimized build and type checks passed; the deployment size guard correctly rejected it. The multilingual content packing change preserves the readable audit data and decodes the compressed runtime corpus once per isolate. The new deployment passed Cloudflare CI and its public build marker reports the complete corpus.

Fresh deployed browser checks passed for the first eight previews and component pages, with no runtime exceptions or horizontal overflow. Anonymous source-panel responses stay locked, omit code and use private/no-store; installation registry endpoints remain unauthorized. The final two previews are checked after their release build. No purchase, billing or account mutation was used for verification.
