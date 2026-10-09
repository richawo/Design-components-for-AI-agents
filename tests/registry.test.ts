import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/registry-types";

const root = path.resolve(__dirname, "..");
const freeDir = path.join(root, "registry/free");
const slugs = fs.readdirSync(freeDir).filter((d) => fs.statSync(path.join(freeDir, d)).isDirectory());
const categories = new Set<string>(Object.keys(CATEGORIES));

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
      const named = /import \{ ([^}]+) \}/.exec(meta.usage)?.[1].split(",").map((s: string) => s.trim()) ?? [];
      expect(named.length).toBeGreaterThan(0);
      for (const n of named) expect(code).toMatch(new RegExp(`export (function|const|type|\\{[^}]*\\b)${n}\\b|export function ${n}\\b`));
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
