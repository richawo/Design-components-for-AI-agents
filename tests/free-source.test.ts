import { expect, it, vi } from "vitest";
vi.mock("@/lib/registry", () => ({
  allComponents: () => [{slug:"free",tier:"free"},{slug:"private",tier:"pro"}],
  getComponent: (slug: string) => slug === "free" ? {tier:"free"} : {tier:"pro"},
  readSource: vi.fn(async () => ({code:"code",prompt:"prompt",promptJson:"{}"})),
}));
vi.mock("@/lib/highlight", () => ({ highlight: async (value: string) => `<pre>${value}</pre>` }));
import { GET, generateStaticParams } from "@/app/api/source/[slug]/route";
import { readSource } from "@/lib/registry";
it("only generates public source and rejects private source before reading it", async () => {
  expect(generateStaticParams()).toEqual([{slug:"free"}]);
  const denied = await GET(new Request("https://example.com"), {params:Promise.resolve({slug:"private"})});
  expect(denied.status).toBe(404);
  expect(readSource).not.toHaveBeenCalled();
  const allowed = await GET(new Request("https://example.com"), {params:Promise.resolve({slug:"free"})});
  expect(await allowed.json()).toEqual({code:"code",prompt:"prompt",promptJson:"{}",codeHtml:"<pre>code</pre>",promptJsonHtml:"<pre>{}</pre>"});
});
