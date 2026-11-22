import fs from "node:fs";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { packContent, unpackContent } from "../scripts/lib/content-pack.mjs";
import { createPublicContent, packPublicContent, publicContentPayloads } from "../scripts/lib/public-content-partitions.mjs";
import { assertSinglePublicContentCopy } from "../scripts/lib/public-content-runtime.mjs";

const fixture = () => ({
  blog: { "guide.md": "---\ntitle: Guide\n---\n# Hello\n```js\nconst x = 1;\n```\n" },
  localizedBlog: { ar: { "guide.md": "# مرحبا\n" }, ja: { "guide.md": "# 日本語\n" } },
  docs: { "install.md": "# Install\n" }, config: { title: "Design for AI" },
});

describe("bounded public editorial partitions", () => {
  it("preserves every original field and byte through full audit and lazy readers", () => {
    const original = fixture(), packed = packPublicContent(original);
    expect(unpackContent(packed)).toEqual(original);
    expect(JSON.stringify(createPublicContent(packed))).toBe(JSON.stringify(original));
    expect(createPublicContent(packContent(original))).toEqual(original);
  });
  it("enumerates locales and filenames without decoding bodies of any edition", () => {
    const packed = packPublicContent(fixture());
    for (const entry of Object.values(packed.locales)) entry.packed.data = "damaged";
    const content = createPublicContent(packed) as ReturnType<typeof fixture>;
    expect(Object.keys(content.localizedBlog)).toEqual(["ar", "ja"]);
    expect(Object.keys(content.blog)).toEqual(["guide.md"]);
    expect(Object.hasOwn(content.localizedBlog.ar, "guide.md")).toBe(true);
    expect(content.docs["install.md"]).toBe("# Install\n");
    expect(() => content.blog["guide.md"]).toThrow();
  });
  it("loads selected editions and evicts the least recently used third edition", () => {
    const packed = packPublicContent(fixture());
    const content = createPublicContent(packed) as ReturnType<typeof fixture>;
    expect(content.blog["guide.md"]).toContain("# Hello");
    expect(content.localizedBlog.ar["guide.md"]).toBe("# مرحبا\n");
    packed.locales.en.packed.data = "damaged";
    expect(content.blog["guide.md"]).toContain("# Hello");
    expect(content.localizedBlog.ja["guide.md"]).toBe("# 日本語\n");
    expect(content.localizedBlog.ar["guide.md"]).toBe("# مرحبا\n");
    expect(() => content.blog["guide.md"]).toThrow();
  });
  it("guards each partition against omission and a duplicated prepared corpus", () => {
    const packed = packPublicContent(fixture());
    const source = publicContentPayloads(packed).map((p) => p.data).join(";");
    expect(assertSinglePublicContentCopy(source, packed)).toBeGreaterThan(0);
    expect(() => assertSinglePublicContentCopy(source + source, packed)).toThrow();
    expect(() => assertSinglePublicContentCopy(source.slice(source.indexOf(";") + 1), packed)).toThrow();
  });
  it("round-trips the complete published multilingual source with bounded locale partitions", () => {
    const data = JSON.parse(fs.readFileSync(new URL("../registry/__generated__/content.json", import.meta.url), "utf8"));
    const packed = JSON.parse(fs.readFileSync(new URL("../registry/__generated__/content-packed.json", import.meta.url), "utf8"));
    expect(packed.encoding).toBe("partitioned-public-v1");
    expect(JSON.stringify(createPublicContent(packed))).toBe(JSON.stringify(data));
    const maxDecodedLocale = Math.max(...Object.values(packed.locales).map((entry: any) => Buffer.byteLength(JSON.stringify(unpackContent(entry.packed)))));
    expect(maxDecodedLocale).toBeLessThan(2 * 1024 * 1024);
    expect(maxDecodedLocale).toBeLessThan(Buffer.byteLength(JSON.stringify(data)) / 10);
  });
  it("does not retain article inputs in gray-matter while serving every language", async () => {
    const { allPosts, rawPost } = await import("../lib/content");
    const { blogLocales } = await import("../lib/blog/runtime");
    const parser = matter as typeof matter & { clearCache(): void; cache: Record<string, unknown> };
    parser.clearCache();
    for (const locale of blogLocales()) {
      const posts = allPosts(locale.code);
      expect(posts.length).toBeGreaterThan(0);
      expect(rawPost(posts[0].slug, locale.code)?.content).toBeTruthy();
    }
    expect(Object.keys(parser.cache)).toEqual([]);
  });
});
