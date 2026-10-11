import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/registry-types";

const root = path.resolve(__dirname, "..");
const freeDir = path.join(root, "registry/free");
const slugs = fs.readdirSync(freeDir).filter((d) => fs.statSync(path.join(freeDir, d)).isDirectory());
const categories = new Set<string>(Object.keys(CATEGORIES));

// Usage examples may include inline type imports, aliases, and line breaks.
// Keep failures about missing names, without dumping the entire source file.
function missingUsageExports(code: string, usage: string) {
  const names = new Set([...code.matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g)].map((match) => match[1]));
  for (const match of code.matchAll(/\bexport\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const item of match[1].split(",")) {
      const name = item.trim().replace(/^type\s+/, "").split(/\s+as\s+/).at(-1)?.trim();
      if (name) names.add(name);
    }
  }
  const imports = [...usage.matchAll(/\bimport\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)]
    .filter((match) => match[2].startsWith(".") || match[2].includes("components/design-for-ai/"))
    .flatMap((match) =>
    match[1].split(",").map((item) => item.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim()).filter(Boolean),
  );
  return { imports, missing: imports.filter((name) => !names.has(name)) };
}

describe("registry usage export validation", () => {
  it("recognizes type imports, aliases, multiline imports and exported bindings", () => {
    const result = missingUsageExports(
      "export type Entry = { id: string }; export interface Props {} export const Menu = () => null; const Inner = 1; export { Inner as Choice };",
      'import {\n Menu as CustomMenu, type Entry, Props, Choice\n} from "./menu"; import { Copy } from "lucide-react";',
    );
    expect(result.imports).toEqual(["Menu", "Entry", "Props", "Choice"]);
    expect(result.missing).toEqual([]);
  });

  it("rejects a private declaration and an export name that does not exist", () => {
    expect(missingUsageExports("type Private = {}; export const Menu = 1;", 'import { Private, Missing } from "./menu";').missing).toEqual(["Private", "Missing"]);
  });
});

describe("free registry", () => {
  it("has components", () => expect(slugs.length).toBeGreaterThan(10));

  describe.each(slugs)("%s", (slug) => {
    const dir = path.join(freeDir, slug);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
    const code = fs.readFileSync(path.join(dir, `${slug}.tsx`), "utf8");
    const prompt = fs.readFileSync(path.join(dir, "prompt.md"), "utf8");
    const promptJson = JSON.parse(fs.readFileSync(path.join(dir, "prompt.json"), "utf8"));

    const draft = meta.status === "draft";

    it("has valid metadata", () => {
      expect(meta.slug).toBe(slug);
      expect(meta.tier).toBe("free");
      expect(["web", "mobile"]).toContain(meta.platform);
      expect(categories.has(meta.category)).toBe(true);
      expect(meta.description.length).toBeGreaterThan(40);
    });

    it.skipIf(draft)("is complete enough to publish", () => {
      expect(meta.props?.length).toBeGreaterThan(0);
      expect(prompt.length).toBeGreaterThan(600);
      expect(Object.keys(promptJson).length).toBeGreaterThan(3);
    });

    it.skipIf(draft)("exports what its usage imports", () => {
      const result = missingUsageExports(code, meta.usage);
      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.missing).toEqual([]);
    });

    it("imports nothing from Pro or the site", () => {
      expect(code).not.toMatch(/from ["'](@\/)?(registry\/pro|components\/site|lib\/)/);
    });

    if (meta.platform === "mobile") {
      it("uses only React Native core and the allowed native libraries", () => {
        const allowed = ["react", "react-native", "expo-blur", "expo-linear-gradient", "react-native-svg"];
        const mods = [...code.matchAll(/from ["']([^"']+)["']/g)].map((m) => m[1]);
        for (const m of mods) expect(allowed).toContain(m);
        // Whatever it imports beyond core is declared, so install commands include it.
        for (const m of new Set(mods)) if (!["react", "react-native"].includes(m)) expect(meta.dependencies ?? []).toContain(m);
      });
    }
  });
});
