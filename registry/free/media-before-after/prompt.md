# Before and After Comparator

Build a standalone React 19 and Tailwind v4 component with the existing named export, props type and overridable default demo.

## Layout and type

Align two original typographic covers in an explicitly full-width 4:3 image stage. Let its 256px minimum height keep small covers legible without widening the stage beyond its card. Clip the wireframe layer from the right as the split changes. Use a crisp vertical divider, 44px handle, 12px before/after labels and a 16px caption. Keep the artwork and surrounding chrome neutral.

## Interaction and data

Keep BeforeAfterProps. before and after are decorative ReactNode layers. Hide them from the accessibility tree and make their descendants inert so host controls cannot enter keyboard navigation.

Use a real native range across the image for pointer dragging, keyboard arrows, Home and End. Keep the divider and clip exactly aligned with the displayed split. Normalize non-finite percentages to 50. Clamp finite values to 0-100 and round them to whole percentages so the native range, divider, clip and announced value agree.

Uncontrolled instances own local state. Controlled instances display the host value and call onChange synchronously; a controlled value without a writer is read-only and offers no drag affordance. The host owns asynchronous work.

Use a visible compound focus ring over both light and dark artwork. Expose the native range and use explicit Canvas/CanvasText system colours in forced-colour mode. The image comparison is a full-surface native range with its visible divider; it retains the control kit hover, press, focus and target-size principles.

Keep instance-scoped caption IDs, useful comparison labels and long copy within the 320px layout.

## Motion

The comparison enters with opacity and an 8px rise over 320ms. The divider follows the native value immediately. The handle has the existing 150ms hover and 100ms press response. Listen to live preference changes and immediately finish the entry without replacing the range or losing focus. Drop handle scaling under reduced motion.

## Integration

Provide aligned decorative before/after layers. Use defaultValue for local interaction or value with onChange for host control. A controlled comparison without a writer is read-only. The host owns persistence; nested visual controls are inert.

Keep all source in one self-contained file with allowed imports. Use the source palettes and font roles, real content, visible focus, written empty states and 320/390/768/1024/1440/1920px container layouts.
