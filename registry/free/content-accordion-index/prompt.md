# Accordion Index

Build a self-contained React 19, Tailwind v4 and motion/react component with the existing typed API, named export and overridable default demo.

## Layout and type

An editorial answer index with a 12px monospaced kicker, a responsive Instrument Serif heading and numbered question rows separated by fine rules. A plus/minus marks each disclosure and the open plain-text answer aligns with its question at 15px with 28px leading. Keep neutral graphite surfaces, 44px targets, readable spacing and long-copy wrapping.

## Interaction

Preserve AccordionEntry, AccordionIndexProps and the named AccordionIndex export. Keep one local expanded ID, initialized from defaultOpen. Opening a question closes the prior answer; choosing the same question closes it.

Use native disclosure buttons with Enter/Space activation, aria-expanded and aria-controls. Every target region has a matching instance-scoped ID and trigger label; closed regions stay hidden and their answer content is not animated in the background.

Key question rows by stable unique IDs so host reordering retains focused disclosures and the actual open question. Missing IDs do not open an unrelated answer by position.

Notify onOpenChange synchronously with the chosen ID or null. It observes local disclosure rather than acting as an asynchronous save or controlled approval.

Keep written empty content, later-arriving questions, long headings/questions/answers and independent instances with unique IDs. Wrap content without document overflow.

The host owns publishing and editing the answers. Supply plain strings and use the callback for integration when useful; disclosure needs no network operation.

## Motion

Enter the whole index with opacity and an 8px rise over 320ms. Mount and reveal only the visible answer with opacity and a 4px rise over 240ms. Keep 150ms question-button feedback. Subscribe to live prefers-reduced-motion changes and stop and settle the owned index/answer controls immediately. Remove press transforms.

## Integration

Supply ordered questions with stable unique IDs. defaultOpen initializes a local open ID; onOpenChange optionally observes the chosen ID or null synchronously. Missing or replaced questions do not open by list position. Each instance owns its disclosure state and region IDs.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.
