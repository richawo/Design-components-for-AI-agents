# Inline Alert

Build a self-contained React 19, Tailwind v4 and motion/react component with the existing typed API, named export and overridable default demo.

## Layout and type

A quiet inline notice with a semantic line icon, a 16px heading and 14px body, plus a separate dismiss action when supplied. An optional action row provides real pending locks and written failure feedback. Keep neutral graphite surfaces, 20px padding, clear hierarchy, 44px targets and wrapping long content. Wrapped action labels retain 8px vertical padding and the directional arrow keeps its full width. Tone changes the meaningful icon without adding decorative severity badges.

## Interaction

Preserve InlineAlertProps and the named InlineAlert export. Render an action or dismissal only when its corresponding callback exists; informational notices need neither.

Await onAction with an immediate duplicate-action guard. Disable action and dismissal while pending, expose aria-busy, show written failure feedback on rejection and allow an exact callback retry. Clear the prior failure when retrying.

Retire pending UI and feedback when title, description, tone, action label or handler availability changes. Replies from a retired context must not change a replacement notice or unlock its newer action.

Equivalent host renders, including a new function identity for the same action, retain pending state. Use the current failure copy when an active request rejects. Ignore late replies after unmount.

onDismiss is a synchronous host request; the host removes the notice. The component does not invent a completed action receipt or persist external work on its own.

Use instance-scoped headings and support long labels/bodies/errors, different tones and independent notices without overflow. For a new resource with identical visible copy, key the component by resource identity; the host owns cancellation of its external operation.

## Motion

Enter the notice with opacity and an 8px rise over 320ms. Keep 150ms action/dismiss feedback and immediate pending locks. Written feedback reflects the active host operation. Subscribe to live prefers-reduced-motion changes and stop and settle the owned entrance immediately. Remove press transforms.

## Integration

Provide onAction for an awaited operation and onDismiss when the host can remove the notice. The component locks active controls, retains failures for retry and ignores replies from replaced content or unmounted instances. Key identical-copy notices by resource identity and manage cancellation of external work in the host.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.

Keep the pending action focusable with aria-disabled and an immediate activation guard. Pending and completed requests preserve its keyboard focus; if the user tabs away, completion keeps focus outside. The dismiss button remains disabled while pending.
