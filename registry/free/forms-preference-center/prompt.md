# Communication Preferences

Build a standalone React 19, Tailwind v4 and motion/react preference form with the existing named export, typed API and overridable default demo.

## Layout and type

Keep the calm, single-column communication form: a small bell, 30px Instrument Serif heading, 14px option labels and descriptive copy, generous ruled checkbox rows and an aligned save/status row. Use 12px Always on metadata. Keep all surfaces neutral, and set the shared checkbox line token to #737373 so unchecked controls exceed 3:1 contrast in both themes. Keep the existing reserved feedback/button sizing so pending, failure and success do not move the save action.

## Interaction and persistence

Keep PreferenceOption and PreferenceCenterProps. Options use stable unique IDs; required choices always stay selected. Normalize selected IDs to the available choices and deduplicate them.

Use local defaultValue state or value with onChange. Controlled choices without a writer are disabled. onChange receives an independent array synchronously and cannot mutate the local draft.

onSave receives a copied snapshot and remains awaited. Permit one write at a time; guard immediately with a ref so checkbox events and duplicate submissions cannot edit or resubmit the in-flight draft.

Keep rejected drafts checked and show the supplied retryable failure copy. Retrying sends the same actual selection. Preserve native checkbox keyboard behavior, visible focus and the focused save action.

Choice-ID, required-state or selected-set replacement retires old feedback. Keep the existing write pending until it finishes, then permit the next write. A late completion cannot mark replacement preferences as saved. Reordering equivalent options or receiving the same selected set keeps the acknowledgement valid.

Disable save without onSave or without available choices. Keep written empty states, independent instances, long copy, required labels and a polite status region. Do not invent a cancellation or concurrent-persistence contract.

## Motion

The form enters with opacity and an 8px rise over 320ms. Use the embedded checkbox control kit for checkmark, hover, press and focus behavior. Keep pending fields locked without remounting or changing footer geometry. Listen to live preference changes and stop and settle the form entry immediately. The control kit removes its scaling and checkmark travel under reduced motion.

## Integration

Provide stable option IDs. Use defaultValue for local drafts, or value with onChange for host control. onChange receives a copied array; onSave is awaited and serialized. Keep server persistence and record versioning in the host. Key the component by account when changing its owner; retired UI feedback does not cancel the host operation.

Use the source dark/light palettes, the embedded control kit, 44px interaction areas and 320/390/768/1024/1440/1920px container layouts.
