import { describe, expect, it } from "vitest";
import { packRouterManifest } from "../scripts/lib/router-manifest-pack.mjs";

const manifest = {
  version: 4,
  routes: {
    "/ar/blog/example": { initialRevalidateSeconds: false, headers: { "cache-control": "public", link: '<https://example.test>; rel="alternate"' }, title: "دليل 日本語", zero: 0, missing: null },
    "/components/chart": { initialRevalidateSeconds: false, dataRoute: "/components/chart.rsc" },
  },
  dynamicRoutes: { "/account": { fallback: null, routeRegex: "^/account$" } },
  notFoundRoutes: ["/removed"],
  preview: { previewModeId: "fixture-id", previewModeSigningKey: "fixture-signing-key", previewModeEncryptionKey: "fixture-encryption-key" },
};
const source = (value: unknown) => `export const PrerenderManifest = ${JSON.stringify(value)};\nexport const untouched = "PrerenderManifest = source code";\n`;
async function execute(code: string) {
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  return import(/* @vite-ignore */ url);
}

describe("public router manifest packing", () => {
  it("preserves every route, cache header, fallback, preview field, Unicode value and key order", async () => {
    const result = packRouterManifest(source(manifest), manifest, { minimumBytes: 0 });
    const module = await execute(result.code);
    expect(module.PrerenderManifest).toEqual(manifest);
    expect(Object.keys(module.PrerenderManifest.routes)).toEqual(Object.keys(manifest.routes));
    expect(module.untouched).toBe("PrerenderManifest = source code");
    expect(result.packed).toBe(true);
    expect(result.routes).toBe(2);
    expect(result.encoding).toBe("gzip-base64");
  });

  it("keeps small verified manifests unchanged", () => {
    const original = source(manifest);
    expect(packRouterManifest(original, manifest).code).toBe(original);
    expect(packRouterManifest(original, manifest).packed).toBe(false);
  });

  it("rejects an altered manifest rather than losing a route or authentication field", () => {
    const changed = structuredClone(manifest);
    changed.preview.previewModeSigningKey = "different";
    expect(() => packRouterManifest(source(changed), manifest)).toThrow("differs from the production build input");
    expect(() => packRouterManifest(source({ ...manifest, routes: {} }), manifest)).toThrow("differs");
  });

  it("does not evaluate expressions or accept special object-literal prototype semantics", () => {
    expect(() => packRouterManifest("var PrerenderManifest = { routes: dangerous() };", manifest)).toThrow("unsupported expression");
    expect(() => packRouterManifest('var PrerenderManifest = { "__proto__": null };', {})).toThrow("Unsupported router manifest key");
    expect(() => packRouterManifest("var PrerenderManifest = { get routes() { throw Error('executed'); } };", manifest)).toThrow("non-data property");
  });

  it("fails closed on missing, ambiguous or colliding generated declarations", () => {
    expect(() => packRouterManifest("const unrelated = {};", manifest)).toThrow("declaration changed");
    expect(() => packRouterManifest("var PrerenderManifest = {}; var PrerenderManifest = {};", {})).toThrow("declaration changed");
    expect(() => packRouterManifest(source(manifest) + "const __dfa_route_manifest_decode = 1;", manifest)).toThrow("name collision");
  });

  it("preserves a growing catalogue with a much smaller encoded routing payload", async () => {
    const routes = Object.fromEntries(Array.from({ length: 6500 }, (_, index) => [
      `/de/blog/workflow-${index}`,
      { initialRevalidateSeconds: false, srcRoute: "/(localized)/[locale]/blog/[slug]", dataRoute: `/de/blog/workflow-${index}.rsc`, initialHeaders: { "cache-control": "public, max-age=0, must-revalidate" } },
    ]));
    const large = { ...manifest, routes };
    const original = source(large);
    const result = packRouterManifest(original, large);
    expect(result.encoding).toBe("brotli-base64");
    expect(result.afterBytes).toBeLessThan(result.beforeBytes / 5);
    expect(result.routes).toBe(6500);
    expect((await execute(result.code)).PrerenderManifest).toEqual(large);
  });
});
