# Shortcut Recorder

Build a self-contained React 19, Tailwind v4 and motion/react keyboard shortcut setting with the existing named component, typed API and overridable default demo.

## Layout and type

A compact shortcut setting with a 26px command icon, 20px label and readable description, followed by a generous dashed recording button containing raised monospaced keycaps. Keep neutral graphite surfaces, 44px targets, a 96px minimum recording target with 16px padding and 12px written feedback beside a separate reset action. Wrap long host key labels and modifier combinations without overflowing the container.

## Interaction

Preserve ShortcutRecorderProps and the named ShortcutRecorder export. Use defaultValue for local state or value with onChange for controlled acknowledgement. Copy the initial and notification arrays so a callback cannot mutate the stored chord. Controlled values without a writer disable recording and reset.

Record only after deliberate activation of the focused record button. Capture keyboard events on that button rather than globally; typing elsewhere remains unaffected. Ignore composing, Dead, Process and modifier-only key events.

Accept Control, Alt or Meta chords and standalone F1 through F12. Shift alone is not a sufficient modifier. Keep the ordered modifier names Control, Alt, Shift, Meta followed by the final key; uppercase single-character keys. Explain invalid unmodified keys without discarding the current chord or leaving recording mode.

Escape cancels without changing the chord and keeps focus; Tab exits without trapping navigation; blur retires recording. Disabled or read-only changes retire active recording. Reset notifies a copied default sequence and returns focus to the record button.

Keep exact controlled proposals without replacing the host value until it acknowledges. Show recorded/reset feedback only while the actual chord matches that feedback, including after host replacements. Empty sequences have a written not-set label and remain recordable when enabled. Use instance-scoped descriptions and support independent recorders, long labels and separate themes.

onChange is a synchronous chord notification. The host owns global shortcut registration, OS/browser conflicts, validation and persistence. Recording a sequence does not register a shortcut.

## Motion

Enter the card once with opacity and an 8px rise over 320ms. Keep 150ms press feedback on recording and reset controls. No ambient loops. Subscribe to live prefers-reduced-motion changes and stop and settle the owned card entrance immediately. Remove press transforms.

## Integration

Use defaultValue for an initial/reset chord or value with onChange for controlled acknowledgement. The callback receives a separate array synchronously. Register shortcuts in the host and handle OS/browser conflicts and persistence there. Events are captured only while the focused button is recording.

Use the source dark/light palettes, visible focus and 320/390/768/1024/1440/1920px container layouts.
