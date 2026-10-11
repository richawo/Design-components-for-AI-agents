/** Confirm an actual copy and restore the reader's place after legacy fallback. */
export async function copyText(text: string, options: {
  document?: Document;
  writeText?: (text: string) => Promise<void>;
} = {}): Promise<boolean> {
  try {
    if (options.writeText) await options.writeText(text);
    else await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and denied clipboard access can use the selection API.
  }

  const doc = options.document ?? document;
  if (typeof doc.execCommand !== "function") return false;
  const active = doc.activeElement as HTMLElement | null;
  const selection = doc.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const input = active && /^(INPUT|TEXTAREA)$/.test(active.tagName) ? active as HTMLInputElement | HTMLTextAreaElement : null;
  const start = input?.selectionStart;
  const end = input?.selectionEnd;
  const direction = input?.selectionDirection;
  const field = doc.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.setAttribute("aria-hidden", "true");
  field.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
  doc.body.appendChild(field);
  try {
    field.select();
    return doc.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    field.remove();
    if (active?.isConnected) active.focus({ preventScroll: true });
    if (input && typeof start === "number" && typeof end === "number") input.setSelectionRange(start, end, direction ?? undefined);
    if (selection && ranges.every((range) => range.startContainer.isConnected && range.endContainer.isConnected)) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
}
