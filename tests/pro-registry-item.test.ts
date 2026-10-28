import { expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  source: { code: "export const Demo = () => null;", prompt: "brief", promptJson: "{}" },
  item: { name: "example", dependencies: ["motion"], files: [{ path: "registry/pro/example/example.tsx", type: "registry:component", target: "components/design-for-ai/example.tsx", content: "" }] },
}));
vi.mock("@/registry/__generated__/index.json", () => ({ default: [] }));
vi.mock("@/registry/__generated__/server-data", async () => ({
  sourceLoaders: { example: async () => ({ default: (await import("../scripts/lib/content-pack.mjs")).packContent(fixture.source) }) },
  proItemLoaders: { example: async () => ({ default: fixture.item }), missing: async () => ({ default: fixture.item }) },
  thumbnails: new Set(), videos: new Set(), styleThumbnails: {},
}));
import { readProItem } from "@/lib/registry";

it("assembles the identical registry download without duplicating bundled source", async () => {
  expect(await readProItem("example")).toEqual({ ...fixture.item, files: [{ ...fixture.item.files[0], content: fixture.source.code }] });
  expect(fixture.item.files[0].content).toBe("");
});

it("does not return incomplete downloads or resolve inherited loader keys", async () => {
  expect(await readProItem("missing")).toBeNull();
  expect(await readProItem("toString")).toBeNull();
  expect(await readProItem("free-example")).toBeNull();
});
