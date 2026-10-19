# Workspace Setup Checklist

Build a standalone React 19, Tailwind v4 and motion/react checklist with the existing named export, typed API and overridable default demo.

## Layout and type

Preserve the focused setup checklist: a 64px drawn completion ring beside a 30px Instrument Serif heading, 14px task titles and instructions, generous ruled task rows and a quiet completion footer. Use 12px mono duration labels and the embedded checkbox kit with #737373 unchecked boundaries, at least 3:1 in both neutral themes. Checkbox completion and instruction disclosure are separate 44px targets.

## Interaction

Keep SetupTask and SetupChecklistProps. Use stable unique task IDs as React keys so reordering retains focused checkbox/disclosure DOM and open instructions.

Use defaultCompleted for a local draft or completed with onChange for host control. Filter completion IDs to available tasks and deduplicate them. Required external setup work remains the host responsibility; checking a row only updates completion state.

Pass an independent completion array to onChange synchronously. A host callback cannot mutate the stored local draft. Controlled completion without a writer is disabled while instruction disclosures remain active.

Keep the ring, visible count, accessible count and written footer consistent with actual checked rows. A refused controlled proposal must not appear complete. Support check and uncheck, singular remaining-step copy, all-complete and no-configured-tasks states.

Keep one instruction disclosure open at a time, with aria-expanded and instance-scoped aria-controls. Native Enter and Space activate buttons and checkboxes. Expose completion feedback through a polite status.

Accept empty and arriving task lists, long descriptions and independent instances without overflow or ID collisions. Duration values are host display labels, without parsing or external operations.

## Motion

Enter the whole checklist with opacity and an 8px rise over 320ms. Draw the ring from empty over 400ms after a 160ms initial delay; later completion changes animate in either direction without that delay. Use the embedded checkbox hover, press, focus and checkmark treatment. Rotate the active instruction chevron over 150ms. Subscribe to live prefers-reduced-motion changes. Stop and settle the owned card/ring controls immediately; the checkbox kit removes transforms and checkmark travel.

## Integration

Supply stable unique task IDs. Use defaultCompleted for a local checklist, or completed with onChange for host acknowledgement. onChange receives an independent normalized ID array synchronously. Perform setup work and persistence in the host; the checkbox records completion and does not run an external action.

Use the source dark/light palettes, visible focus and 320/390/768/1024/1440/1920px container layouts.
