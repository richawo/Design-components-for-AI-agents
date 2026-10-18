# Topic Tag Editor

Build this self-contained React 19, Tailwind CSS v4 and motion/react component. Edit a small collection of topic labels directly, with an explicit count and visible removal controls.

A roomy wrap-first text field with fitted topic chips, small remove keys and a lightweight count. Return focus to the text entry after addition or removal. Keep neutral #111111/#ffffff panels, #f5f5f5/#171717 ink, #a3a3a3/#525252 secondary text and #333333/#d4d4d4 hairlines. Distinguish the topic well with #727272/#8a8a8a borders. Use 14-16px body text, 12px mono counts and a 20px medium label. Interactive targets remain at least 44px.

- Parse Enter, comma and pasted comma/newline lists; trim pieces, deduplicate case-insensitively and retain accepted order.
- Respect IME composition. Remove the last tag with Backspace only when the entry is empty; return focus to the entry after addition or removal.
- Keep independent copies of incoming defaults, local tags and emitted arrays so host mutation cannot alter the field.
- Apply a finite nonnegative addition limit without silently deleting existing host tags. At the limit, retain removal and block further entry.
- Controlled values wait for the host; proposals report a requested change. Controlled values without a writer and disabled instances cannot edit.

Use a brief 8px entrance with opacity. Respect reduced motion on first view and when changed while mounted. Keep visible keyboard focus, meaningful pressed/value states and instance-scoped labels. Verify 320/390/768/1024/1440/1920px containers and both themes. Preserve the complete offline default demo and its named data-demo targets. Avoid marketing headers, invented security claims, decorative status badges and remote dependencies.
