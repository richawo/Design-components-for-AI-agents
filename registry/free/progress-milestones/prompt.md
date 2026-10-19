# Milestone Progress

Build a self-contained React 19, Tailwind v4 and motion/react component with the existing typed API, named export and overridable default demo.

## Layout and type

A focused sprint progress card with a compact heading and completed-stage count, a fine drawn completion rail and numbered stage actions. Completed circles become checkmarks; the current stage points toward a written detail below. Keep neutral graphite surfaces, 14px stage labels, 12px counts, 44px targets and 3:1 control boundaries. Long labels and details wrap naturally.

## Interaction

Preserve Milestone, MilestoneProgressProps and the named MilestoneProgress export. current is a host-owned positional index; notify the clicked index synchronously and retain the actual host position until it changes.

Clamp finite indices to the collection and normalize invalid values to zero. A position equal to steps.length means complete. Empty collections retain a zero progress value and written no-milestones state.

Keep a native progressbar with finite 0-100 bounds, an accurate rounded percentage and a written current-stage detail. The visual completion fill follows the exact fraction in both directions.

Key stage rows by stable unique IDs so reordering retains focus. Use native buttons, Enter/Space activation, visible focus and at least 3:1 circle boundaries. Rows without a navigation handler are non-interactive.

Use separate heading IDs for independent instances. Support empty/arriving stages, completed workflows and long labels/details without document overflow.

The host owns milestone completion and persistence. Stage navigation is not a save, approval or completion operation.

## Motion

Enter the card with opacity and an 8px rise over 320ms. Draw the first completion fill from zero over 350ms after a 160ms delay. Later completion changes animate both directions over 350ms. Key actual stage details and enter them with opacity and a 4px rise over 240ms. Keep 150ms stage-button feedback. Subscribe to live prefers-reduced-motion changes and stop and settle owned card, fill and detail controls immediately. Remove press transforms.

## Integration

Supply ordered stages with unique stable IDs and the actual current index. The index is positional, so rebase it when the host reorders data. onStepChange requests navigation synchronously; update current when the host accepts. Use steps.length to display completion and manage persistence externally.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.

Keep the header count in one non-shrinking block beside long titles. Give wrapped stage labels 8px vertical inner space while retaining 44px default targets.
