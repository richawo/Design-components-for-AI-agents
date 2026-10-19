import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES } from "@/lib/block-types.mjs";

/**
 * Pro components live in a private repository. These checks fail the build if
 * any of their source reaches files tracked in this public one.
 */

const root = path.resolve(__dirname, "..");
const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const manifest: { slug: string; usage: string }[] = JSON.parse(
  fs.readFileSync(path.join(root, "registry/pro-manifest.json"), "utf8"),
);
function componentImports(usage: string) {
  return [
    ...usage.matchAll(
      /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*["']([^"']+)["']/g,
    ),
  ]
    .filter((match) => match[2].includes("components/design-for-ai/"))
    .flatMap((match) =>
      match[1]
        .split(",")
        .map((name) =>
          name
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0]
            .trim(),
        )
        .filter(Boolean),
    );
}
const importsByComponent = manifest.map((m) => componentImports(m.usage));
const proNames = [...new Set(importsByComponent.flat())];
// One pass per file retains the same export-name boundary without rescanning
// every source once for each private component.
const proExport = new RegExp(`export (?:default )?function (${proNames.join("|")})\\b`, "g");

describe("Pro usage import detection", () => {
  it("checks every component name in compound, aliased and type imports", () => {
    expect(
      componentImports(`import {
  BentoGrid as Grid, TrendTile, type MapTileProps,
} from "@/components/design-for-ai/bento-grid";
import type { TrendTileProps as Props } from "@/components/design-for-ai/bento-grid";
import { MapPin } from "lucide-react";`),
    ).toEqual(["BentoGrid", "TrendTile", "MapTileProps", "TrendTileProps"]);
  });

  it("does not treat unrelated imports as Pro names", () => {
    expect(
      componentImports(
        'import { Copy } from "lucide-react"; import { Header } from "./header";',
      ),
    ).toEqual([]);
  });
});

describe("no Pro source in the public repository", () => {
  it("tracks nothing under registry/pro", () => {
    expect(tracked.filter((f) => f.startsWith("registry/pro/"))).toEqual([]);
  });

  it("has no free component folder named after a Pro component", () => {
    const pro = new Set(manifest.map((m) => m.slug));
    expect(
      tracked.filter(
        (f) => f.startsWith("registry/free/") && pro.has(f.split("/")[2]),
      ),
    ).toEqual([]);
  });

  it("defines no Pro component in any tracked source file", () => {
    expect(
      manifest
        .filter((_, i) => importsByComponent[i].length === 0)
        .map((m) => m.slug),
    ).toEqual([]);
    const code = tracked.filter(
      (f) => /\.(tsx?|jsx?|mjs|html)$/.test(f) && !f.startsWith("tests/"),
    );
    const hits: string[] = [];
    for (const f of code) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      const definitions = new Set([...src.matchAll(proExport)].map(match => match[1]));
      for (const name of proNames)
        if (definitions.has(name)) hits.push(`${f}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it("keeps component folders to their four files", () => {
    const allowed =
      /^registry\/free\/([^/]+)\/(\1\.tsx|meta\.json|prompt\.md|prompt\.json)$/;
    expect(
      tracked.filter((f) => f.startsWith("registry/free/") && !allowed.test(f)),
    ).toEqual([]);
  });

  it("keeps the manifest to public metadata", () => {
    for (const m of manifest)
      expect(Object.keys(m)).not.toEqual(expect.arrayContaining(["code"]));
    expect(JSON.stringify(manifest)).not.toMatch(
      /useState\(|useEffect\(|useRef\(/,
    );
  });

  it("allows only meta.json keys in the manifest, and no source inside demo or controls", () => {
    const allowed = new Set([
      "slug",
      "name",
      "tier",
      "platform",
      "category",
      "description",
      "tags",
      "dependencies",
      "theme",
      "previewHeight",
      "usage",
      "props",
      "added",
      "status",
      "demo",
      "controls",
      "kind",
      "blockType",
      "components",
    ]);
    for (const m of manifest)
      for (const k of Object.keys(m))
        expect(allowed.has(k), `${(m as { slug: string }).slug}: ${k}`).toBe(
          true,
        );
    for (const entry of manifest as {
      kind?: string;
      blockType?: string;
      components?: string[];
    }[]) {
      if (entry.kind === "block") {
        expect(BLOCK_TYPES).toContain(entry.blockType);
        expect(entry.components?.length).toBeGreaterThanOrEqual(2);
        for (const slug of entry.components ?? [])
          expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    }
    // Demo steps and control values are short strings: never code, prompts or file contents.
    const extras = JSON.stringify(
      manifest.map((m) => [
        (m as { demo?: unknown }).demo,
        (m as { controls?: unknown }).controls,
      ]),
    );
    expect(extras).not.toMatch(
      /=>|export |import |function |className=|<\w+[\s>]/,
    );
    expect(extras.length).toBeLessThan(manifest.length * 4000);
  });
});
