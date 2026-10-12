import { expect, it } from "vitest";
import {
  validateComposition,
  installedBlockSource,
  compositionRegistryDependencies,
} from "@/scripts/lib/block-composition.mjs";
import { installationOrder } from "@/packages/cli/composition.mjs";

const free = { slug: "free-chart", tier: "free", platform: "web" };
const pro = { slug: "pro-table", tier: "pro", platform: "web" };
const block = {
  slug: "block-overview",
  tier: "pro",
  kind: "block",
  blockType: "dashboard",
  platform: "web",
  components: [free.slug, pro.slug],
};
const code = `// import { Private } from "../secret/secret";\nimport { Chart } from "../../free/free-chart/free-chart";\nimport { Table } from '../pro-table/pro-table';\nexport const Overview = () => <><Chart/><Table/></>;`;

it("rewrites only real declared imports and keeps Pro dependencies in the protected registry namespace", () => {
  const catalogue = [free, pro, block];
  expect(validateComposition(block, code, catalogue)).toEqual([]);
  const installed = installedBlockSource(block, code);
  expect(installed).toContain('from "./free-chart"');
  expect(installed).toContain('from "./pro-table"');
  expect(installed).toContain('from "../secret/secret"');
  expect(
    compositionRegistryDependencies(block, catalogue, "https://design.yaps.ai"),
  ).toEqual([
    "https://design.yaps.ai/r/free-chart.json",
    "@design-for-ai-pro/pro-table",
  ]);
});

it("rejects source escapes, missing imports and a free block with a Pro dependency", () => {
  const catalogue = [free, pro, block];
  expect(
    validateComposition(
      block,
      code + '\nimport "../../../lib/license";',
      catalogue,
    ).join(" "),
  ).toContain("not a declared");
  expect(
    validateComposition({ ...block, tier: "free" }, code, catalogue).join(" "),
  ).toContain("free block cannot depend on Pro");
  expect(
    validateComposition(
      block,
      "export const Overview = () => null;",
      catalogue,
    ).join(" "),
  ).toContain("never imported");
  expect(
    validateComposition(
      { ...free, components: [pro.slug] },
      "",
      catalogue,
    ).join(" "),
  ).toContain("only supported on blocks");
});

it("detects cycles and unpublished or incompatible dependencies before generation", () => {
  const nested = { ...pro, kind: "block", components: [block.slug] };
  expect(
    validateComposition(block, code, [free, nested, block]).join(" "),
  ).toContain("cycle");
  expect(
    validateComposition(block, code, [
      { ...free, status: "draft" },
      { ...pro, platform: "mobile" },
      block,
    ]).join(" "),
  ).toMatch(/not published.*not a web component/);
});

it("installs nested and shared dependencies once before their parent and rejects incomplete graphs", () => {
  const nested = { slug: "block-nested", components: [free.slug, block.slug] };
  expect(
    installationOrder(
      [nested.slug, block.slug],
      [free, pro, block, nested],
    ).map((entry) => entry.slug),
  ).toEqual([free.slug, pro.slug, block.slug, nested.slug]);
  expect(() => installationOrder([block.slug], [free, block])).toThrow(
    "Unknown component dependency",
  );
  expect(() =>
    installationOrder(
      [block.slug],
      [free, { ...pro, components: [block.slug] }, block],
    ),
  ).toThrow("Circular block dependency");
});
