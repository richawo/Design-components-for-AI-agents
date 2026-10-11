import { describe, expect, it } from "vitest";
import { compactGeneratedSourceMap } from "../scripts/lib/source-map-budget.mjs";

describe("Cloudflare source-map budget", () => {
  it("preserves all mappings and application source while omitting duplicate generated handlers", () => {
    const map = { version: 3, sources: ["../.open-next/server-functions/default/handler.mjs", "C:\\build\\.open-next\\middleware\\handler.mjs", "../lib/blog/seo.ts"], sourcesContent: ["large generated server", "large generated middleware", "application source"], names: ["articleMetadata"], mappings: "AAAA;AACA", ignoreList: [0, 1] };
    const result = compactGeneratedSourceMap(map);
    expect(result.omitted).toBe(2);
    expect(result.map).toEqual({ ...map, sourcesContent: [null, null, "application source"] });
    expect(map.sourcesContent[0]).toBe("large generated server");
  });
  it("accepts maps without embedded sources and leaves ordinary source content intact", () => {
    const map = { version: 3, sources: ["src/index.ts"], names: [], mappings: "AAAA" };
    expect(compactGeneratedSourceMap(map)).toEqual({ map, omitted: 0 });
  });
  it("handles the relative source paths emitted when the bundle stays inside .open-next", () => {
    const map = { sources: ["../server-functions/default/handler.mjs", "../middleware/handler.mjs", "../lib/middleware/handler.mjs"], sourcesContent: ["server", "middleware", "app code"], mappings: "AAAA" };
    expect(compactGeneratedSourceMap(map)).toEqual({ map: { ...map, sourcesContent: [null, null, "app code"] }, omitted: 2 });
  });
});
