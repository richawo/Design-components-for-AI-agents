import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ license: vi.fn(), item: vi.fn() }));
vi.mock("@/lib/registry", () => ({
  getComponent: (slug: string) => ({
    tier: slug === "former-pro" ? "free" : "pro",
  }),
  readProItem: f.item,
}));
vi.mock("@/lib/commerce/licences", () => ({
  requireCommerceLicense: f.license,
}));
vi.mock("@/lib/license", () => ({
  unauthorized: (reason: string) => Response.json({ reason }, { status: 401 }),
}));
import { GET } from "@/app/r/pro/[slug]/route";
beforeEach(() => {
  vi.resetAllMocks();
  f.license.mockResolvedValue({ ok: false, reason: "Sign in" });
});
it("forwards old Pro installs to public source after a tier change without requesting a licence", async () => {
  const result = await GET(
    new Request("https://design.yaps.ai/r/pro/former-pro.json"),
    { params: Promise.resolve({ slug: "former-pro.json" }) },
  );
  expect(result.status).toBe(302);
  expect(result.headers.get("Location")).toBe(
    "https://design.yaps.ai/r/former-pro.json",
  );
  expect(f.license).not.toHaveBeenCalled();
  expect(f.item).not.toHaveBeenCalled();
});
it("retains the licence gate and private caching for components still in Pro", async () => {
  const request = new Request("https://design.yaps.ai/r/pro/premium.json");
  const params = { params: Promise.resolve({ slug: "premium.json" }) };
  expect((await GET(request, params)).status).toBe(401);
  expect(f.item).not.toHaveBeenCalled();
  f.license.mockResolvedValue({ ok: true });
  f.item.mockResolvedValue({ name: "premium", files: [] });
  const result = await GET(request, params);
  expect(result.status).toBe(200);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await result.json()).toEqual({ name: "premium", files: [] });
});
it("rejects malformed registry paths before source or licence resolution", async () => {
  const result = await GET(
    new Request("https://design.yaps.ai/r/pro/invalid"),
    { params: Promise.resolve({ slug: "../former-pro" }) },
  );
  expect(result.status).toBe(404);
  expect(f.license).not.toHaveBeenCalled();
  expect(f.item).not.toHaveBeenCalled();
});
