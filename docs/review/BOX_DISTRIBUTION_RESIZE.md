# Box Distribution resize and audit follow-up

The 26-component audit found 8 px of horizontal overflow after its touch preview narrowed from 390 to 320 px. A software-rendered replay reproduced it: the chart retained its 290 px plot until a delayed ResizeObserver report arrived. The settled plot was correctly 220 px wide.

The chart now publishes viewport measurements through a synchronous React external store. Both viewport events and ResizeObserver notifications read the current DOM box. A queued observer entry can describe the previous wider layout, so its recorded dimensions cannot overwrite the current measurement. Both subscriptions detach when the measured element retires. Unavailable-to-ready recovery retains its existing coverage.

A deterministic browser regression holds observer reports after initial layout and inspects the first animation frame after resizing. It keeps all seven rows mounted and requires both zero document overflow and the smaller plot, without extending a settling wait. It then replays the original wider reports and requires the current geometry to survive.

| Replay | Plot width in first resize frame | Horizontal overflow |
| --- | --- | --- |
| Previous source, observer reports held | 290 px | 8 px |
| Current source, observer reports held | 220 px | 0 px |
| Current source, direct resize subscription blocked | 290 px | 8 px |

Replaying the wider reports against an entry-based callback restored 8 px of overflow; the final live-box callback retains the 220 px plot and 0 px overflow. The blocked-subscription control fails the same first-frame assertion. An intermediate ordinary state update also missed the first frame, so the final change uses a synchronous subscription.

The registered regression is in `tests/browser/review/chart-box-distribution.mjs`. Raw source hashes, replay logs, the original source and the control fixture remain in the ignored `test-results/frontend-latency-replays/box-distribution-resize-2026-10-18/` directory. The initial batch and software/native diagnosis remain under `test-results/handoff-next/`.

## Audit frame readiness

The application audit initially still reported overflow after the source fix. Instrumentation showed its geometry read at 19,534 ms, the iframe resize event at 20,200 ms, and the first painted frame at 20,513 ms. The pre-paint plot was 290 px; the first painted plot was 220 px with no overflow. The parent frame was visible and at scroll position zero.

The auditor now requires the requested preview source, waits for actual paint around its existing settling delays, and lets temporary screenshot-height changes finish before continuing. Paint waits have a ten-second bound. It still rejects overflow, accessibility violations and running reduced-motion animations. The original diagnostic report is retained under `test-results/handoff-next/box-frame-diagnosis/`.

## Handle contrast

Sampling the painted light theme exposed white handle text on `#0284c7` at 4.09:1. The old 0.4 luminance crossover chose the wrong foreground. The component now composites supported hex alpha over the chart surface and selects pure black or white at the 0.179 crossover. The default light blue handle uses black text at approximately 5.13:1. Grey, short-alpha and long-alpha accents have dedicated contrast coverage.

The target-met light verdict also failed at 4.27:1 (`#15803d` on `#e3f0e8`). Its darker `#166534` ink now passes on the same semantic tint. The regression composites actual DOM backgrounds through Canvas before checking handle and verdict contrast.

The neutral white demo preset follows the theme ink in light mode. Own-key lookup also keeps prototype-named unsupported colours on the safe fallback path. Both cases are covered by the browser regression.

The painted audit passes the normal component with zero overflow, accessibility violations or running reduced-motion animations. Injecting a persistent 8px overflow still fails at every desktop width from 320 to 1920px, with no runtime or accessibility errors contributing to the rejection. The control report is retained in `test-results/handoff-next/box-audit-negative/`.
