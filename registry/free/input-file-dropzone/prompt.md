# Source File Dropzone

Build a self-contained React 19, Tailwind v4 and motion/react document chooser with the existing typed API, named component and overridable default demo.

## Layout and type

A focused document chooser with a dashed drop surface, restrained upload icon, 30px Instrument Serif invitation, explicit 44px browse button and compact removable file rows below. Keep neutral graphite surfaces, clear type hierarchy, 12px monospaced size/limit labels and a quiet selection or rejection status. Wrap long filenames without squeezing the remove target.

## Interaction

Preserve FileDropzoneProps and the named FileDropzone export. Use real File objects and the native multiple file picker, plus file drag and drop. A non-file drag must not activate the drop highlight; nested file enters and leaves retain the correct highlight, and disabling or entering read-only mode clears it.

Copy the initial defaultFiles array and every onChange array without replacing the File objects. Keep local state for undefined files; controlled files require onChange for changes, otherwise disable chooser and removal and ignore drops. onChange is a synchronous notification, not an upload or persistence operation.

Validate comma-separated extensions, exact MIME types and type/* wildcards, case-insensitively. Reject files exceeding maxBytes, duplicate name/size/lastModified signatures and files beyond maxFiles. Mixed drops keep accepted files while writing specific rejection reasons. Empty drops do not clear existing errors.

Use finite, non-negative size limits and a non-negative integer count limit; non-finite settings fall back to defaults. Show byte sizes and limits using B, KB or MB, so a small non-empty file or budget is not rounded to zero.

Use stable signature and occurrence row keys so host reordering retains focus, including repeated supplied files. When the host accepts removal, move focus to the next available remove action, then the browse button, or the outlined section when choosing is unavailable. A refused or later acknowledged removal must not steal focus from another control.

Keep clear selection count feedback, independent instances, visible focus, written empty status and long-content wrapping at all specified widths. The host owns durable upload, server validation and storage; selecting a document does not claim an upload completed.

## Motion

Enter the card once with opacity and an 8px rise over 320ms. New file rows enter with opacity and a 6px rise over 200ms; retain 220ms row layout and 150ms press feedback. Subscribe to live prefers-reduced-motion changes. Stop and settle owned card/row entrances immediately and remove layout/press transforms. No ambient loops.

## Integration

Use defaultFiles for local selection, or files with onChange for controlled acknowledgement. The callback receives a separate array of the original File objects synchronously. Supply accept, maxBytes and maxFiles for client selection limits; validate files again in the host upload path and manage persistence there.

Use the source dark/light palettes and verify 320/390/768/1024/1440/1920px layouts.
