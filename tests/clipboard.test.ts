import { describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/clipboard";

function fallback(succeeds: boolean) {
  const field = { value: "", readOnly: false, tabIndex: 0, style: { cssText: "" }, setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn() };
  const active = { tagName: "INPUT", isConnected: true, selectionStart: 2, selectionEnd: 5, selectionDirection: "backward", focus: vi.fn(), setSelectionRange: vi.fn() };
  const doc = { activeElement: active, getSelection: () => null, createElement: () => field, body: { appendChild: vi.fn() }, execCommand: vi.fn(() => succeeds) };
  return { field, active, doc: doc as unknown as Document, command: doc.execCommand };
}

describe("truthful copy feedback", () => {
  it("does not report success when both clipboard methods fail", async () => {
    const f = fallback(false);
    expect(await copyText("example", { document: f.doc, writeText: async () => { throw new Error("denied"); } })).toBe(false);
    expect(f.field.remove).toHaveBeenCalledOnce();
    expect(f.active.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(f.active.setSelectionRange).toHaveBeenCalledWith(2, 5, "backward");
  });

  it("uses a successful clipboard write without disturbing selection", async () => {
    const f = fallback(false);
    const writeText = vi.fn(async () => {});
    expect(await copyText("example", { document: f.doc, writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("example");
    expect(f.command).not.toHaveBeenCalled();
  });

  it("confirms a successful legacy fallback and removes its temporary field", async () => {
    const f = fallback(true);
    expect(await copyText("example", { document: f.doc, writeText: async () => { throw new Error("unavailable"); } })).toBe(true);
    expect(f.command).toHaveBeenCalledWith("copy");
    expect(f.field.value).toBe("example");
    expect(f.field.remove).toHaveBeenCalledOnce();
  });
});
