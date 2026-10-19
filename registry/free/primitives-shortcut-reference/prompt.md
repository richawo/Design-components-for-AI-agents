# Shortcut Reference

Build a self-contained React 19, Tailwind v4 and motion/react component with the existing typed API, named export and overridable default demo.

## Layout and type

A compact keyboard reference with a 30px Instrument Serif heading, a clear 44px search field, 12px group labels and a two-column definition list of command names and engraved monospaced keycaps. Keep neutral graphite surfaces and readable rules. The search boundary has at least 3:1 contrast against the panel, long commands and key labels wrap, and filtering does not collapse the minimum results region.

## Interaction

Preserve ShortcutEntry, ShortcutReferenceProps and the named ShortcutReference export. The reference displays host commands and key labels; it does not register or execute keyboard shortcuts.

Filter labels, groups and the rendered key strings, trimming the query and matching case-insensitively. Keep group order from the supplied items and show only matching entries.

Use a labelled controlled text input. The clear action appears for non-empty input, clears the filter and returns focus to the input before the action disappears. Escape clears a non-empty filter while focus stays in the input.

Keep definition-list semantics and instance-scoped heading IDs. Empty lists and unmatched queries have written feedback; later-arriving items respect the retained query.

Support long command names, group names, key labels, Unicode and independent instances without overflow or shared search state. Use at least 3:1 contrast for the search boundary and clear visible focus.

The host owns the command catalogue, platform-specific key labels and actual shortcut registration. Search uses displayed strings without inventing aliases or OS behavior.

## Motion

Enter the card once with opacity and an 8px rise over 320ms. Keep 150ms clear-button feedback and a stable minimum results region while filtering. Subscribe to live prefers-reduced-motion changes and stop and settle the owned entrance immediately. Remove press transforms.

## Integration

Supply command entries with unique IDs, group names and already formatted key labels. Filtering searches those displayed strings. This is a reference, so register and execute shortcuts in the host. Each instance keeps its own filter and focus.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px container layouts.
