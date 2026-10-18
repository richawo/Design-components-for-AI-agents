# Ruler Number Stepper

Build this self-contained React 19, Tailwind CSS v4 and motion/react component. Set a bounded quantity through one large precise number and a ruler that explains its position within the allowed range.

A compact instrument panel: heading and limits on top, 60px editable value between square minus/plus keys, and a 33-tick baseline ruler. Keep neutral #111111/#ffffff panels, #f5f5f5/#171717 ink, #a3a3a3/#525252 secondary text and #333333/#d4d4d4 hairlines. Use 14-16px body text, 12px mono metadata and the existing large working specimen. Interactive targets remain at least 44px.

- Clamp finite edits to normalized bounds; invalid drafts revert, Escape cancels and IME Enter never commits.
- Preserve complete typed values, exact bounds and safe integer digits. Normalize only stepping noise to the precision of its actual operands. Compute a finite ruler position even when subtracting finite endpoints overflows.
- Support arrows, Home/End and Shift-arrow ten-step changes. Canonical buttons repeat after 400ms and every 60ms while held, stopping on outside release, cancellation, blur, disabling or unmount.
- Controlled values wait for host acknowledgement. A missing writer is read-only; disabled prevents all edits. Suppress callbacks for a normalized no-op.
- Keep the canonical control-kit button states around the component-specific large figure and ruler. Live reduced motion settles the ruler immediately.

Use a brief 8px entrance with opacity. Respect reduced motion on first view and when changed while mounted. Keep visible keyboard focus, meaningful pressed/value states and instance-scoped labels. Verify 320/390/768/1024/1440/1920px containers and both themes. Preserve the complete offline default demo and its named data-demo targets. Avoid marketing headers, invented security claims, decorative status badges and remote dependencies.

Keep the panel at 448px maximum width with 24px padding and a 12px radius. The value uses 60px display type, tabular figures and -0.06em tracking; the heading is 18px, body 14px and bounds 12px mono. Use 33 one-pixel ticks, every fourth 20px high and the others 10px; the current marker is 2px by 28px. Values longer than five characters get a full line above the buttons and unit. Fit the complete represented value with a 16-60px font derived from container width and character count. Embed the canonical stepper CSS without altering its generated block.
