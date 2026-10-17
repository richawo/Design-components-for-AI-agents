import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packContent, unpackContent } from "../scripts/lib/content-pack.mjs";

describe("packed editorial content", () => {
  it("preserves multilingual prose, markup and code", () => {
    const content = { en: '<a href="/blog/guide">A guide</a>', ar: "دليل التصميم", ja: "デザインガイド", code: 'const name = "React";\n', empty: {} };
    expect(unpackContent(packContent(content))).toEqual(content);
  });
  it("reproduces the complete generated site bundle with a smaller payload", () => {
    const dir = path.resolve(import.meta.dirname, "../registry/__generated__");
    const original = JSON.parse(fs.readFileSync(path.join(dir, "content.json"), "utf8"));
    const packed = JSON.parse(fs.readFileSync(path.join(dir, "content-packed.json"), "utf8"));
    expect(unpackContent(packed)).toEqual(original);
    expect(Buffer.byteLength(JSON.stringify(packed))).toBeLessThan(Buffer.byteLength(JSON.stringify(original)));
  });
  it("rejects a damaged payload instead of serving incomplete text", () => {
    expect(() => unpackContent({ encoding: "gzip-base64", data: "broken" })).toThrow();
  });
  it("preserves every component's installable code and briefs byte for byte", () => {
    const dir = path.resolve(import.meta.dirname, "../registry/__generated__");
    let originalBytes = 0, packedBytes = 0;
    for (const name of fs.readdirSync(path.join(dir, "sources"))) {
      const original = fs.readFileSync(path.join(dir, "sources", name), "utf8");
      const packed = fs.readFileSync(path.join(dir, "source-packs", name), "utf8");
      expect(unpackContent(JSON.parse(packed))).toEqual(JSON.parse(original));
      originalBytes += Buffer.byteLength(original);
      packedBytes += Buffer.byteLength(packed);
    }
    expect(originalBytes).toBeGreaterThan(0);
    expect(packedBytes).toBeLessThan(originalBytes * 0.6);
  });
});
