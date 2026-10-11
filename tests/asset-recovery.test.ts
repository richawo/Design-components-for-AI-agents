import vm from "node:vm";
import { expect, it, vi } from "vitest";
import { ASSET_RECOVERY_BOOTSTRAP } from "@/lib/asset-recovery";

function browser(storage = new Map<string, string>(), blocked = false) {
  const reload = vi.fn();
  const handlers: Record<string, (event: unknown) => void> = {};
  vm.runInNewContext(ASSET_RECOVERY_BOOTSTRAP, {
    URL, Date, location: { href: "https://design.yaps.ai/preview/example", origin: "https://design.yaps.ai", reload },
    addEventListener: (type: string, callback: (event: unknown) => void) => { handlers[type] = callback; },
    sessionStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => { if (blocked) throw Error("unavailable"); storage.set(key, value); } },
  });
  return { reload, handlers };
}
const chunk = { target: { tagName: "SCRIPT", src: "/_next/static/chunks/old.js" } };

it("recovers a missing build asset without repeating on the reloaded page", () => {
  const storage = new Map<string, string>();
  const first = browser(storage); first.handlers.error(chunk); expect(first.reload).toHaveBeenCalledOnce();
  const next = browser(storage); next.handlers.error(chunk);
  next.handlers.unhandledrejection({ reason: Error("Failed to load chunk /_next/static/chunks/other.js from module 1") });
  expect(next.reload).not.toHaveBeenCalled();
});
it("handles a dynamic chunk rejection and ignores application and external failures", () => {
  const { handlers, reload } = browser();
  handlers.error({ target: { tagName: "IMG", src: "/missing.png" } });
  handlers.error({ target: { tagName: "SCRIPT", src: "https://example.com/_next/static/chunks/a.js" } });
  handlers.unhandledrejection({ reason: Error("ordinary application error") });
  expect(reload).not.toHaveBeenCalled();
  handlers.unhandledrejection({ reason: Error("Failed to load chunk /_next/static/chunks/lazy.js from module 12") });
  expect(reload).toHaveBeenCalledOnce();
});
it("never loops when storage is blocked", () => {
  const { handlers, reload } = browser(new Map(), true);
  handlers.error(chunk); expect(reload).not.toHaveBeenCalled();
});
