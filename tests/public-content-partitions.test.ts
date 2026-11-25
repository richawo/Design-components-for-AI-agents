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
    for (const entry of Object.values(packed.locales)) for (const part of entry.partitions) part.packed.data = "damaged";
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
    packed.locales.en.partitions[0].packed.data = "damaged";
    expect(content.blog["guide.md"]).toContain("# Hello");
    expect(content.localizedBlog.ja["guide.md"]).toBe("# 日本語\n");
    expect(content.localizedBlog.ar["guide.md"]).toBe("# مرحبا\n");
    expect(() => content.blog["guide.md"]).toThrow();
  });
  it("reads existing v1 locale packs without changing their contents", () => {
    const original = fixture();
    const { blog, localizedBlog, ...core } = original;
    const packed = {
      encoding: "partitioned-public-v1" as const, fields: Object.keys(original), core: packContent(core),
      locales: Object.fromEntries(Object.entries({ en: blog, ...localizedBlog }).map(([locale, files]) => [locale, {
        files: Object.keys(files), packed: packContent(files),
      }])),
    };
    expect(unpackContent(packed)).toEqual(original);
    expect(JSON.stringify(createPublicContent(packed))).toBe(JSON.stringify(original));
  });
  it("splits large multilingual locales by UTF-8 bytes and decodes only the requested partition", () => {
    const original = { blog: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [
      `${index}.md`, `${index}:` + "日本語😀".repeat(48000),
    ])), localizedBlog: {} };
    const packed = packPublicContent(original), parts = packed.locales.en.partitions;
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.flatMap((part) => part.files)).toEqual(Object.keys(original.blog));
    for (const part of parts) expect(Buffer.byteLength(JSON.stringify(unpackContent(part.packed)))).toBeLessThan(2 * 1024 * 1024);
    expect(unpackContent(packed)).toEqual(original);
    expect(JSON.stringify(createPublicContent(packed))).toBe(JSON.stringify(original));
    const content = createPublicContent(packed) as typeof original;
    // Unvisited siblings can be damaged without affecting the selected article.
    const saved = parts[1].packed.data;
    parts[1].packed.data = "damaged";
    expect(content.blog[parts[0].files[0]]).toBe(original.blog[parts[0].files[0]]);
    expect(() => content.blog[parts[1].files[0]]).toThrow();
    parts[1].packed.data = saved;
    expect(content.blog[parts[1].files[0]]).toBe(original.blog[parts[1].files[0]]);
    parts[0].packed.data = "damaged";
    expect(content.blog[parts[0].files[0]]).toBe(original.blog[parts[0].files[0]]);
    expect(content.blog[parts[2].files[0]]).toBe(original.blog[parts[2].files[0]]);
    expect(content.blog[parts[1].files[0]]).toBe(original.blog[parts[1].files[0]]);
    expect(() => content.blog[parts[0].files[0]]).toThrow();
  });
  it("rejects an individual article that cannot fit without raising the partition budget", () => {
    expect(() => packPublicContent({ blog: { "too-large.md": "x".repeat(2 * 1024 * 1024) } })).toThrow(/too-large.md/);
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
    expect(packed.encoding).toBe("partitioned-public-v2");
    expect(JSON.stringify(createPublicContent(packed))).toBe(JSON.stringify(data));
    const maxDecodedPartition = Math.max(...Object.values(packed.locales).flatMap((entry: any) => entry.partitions.map((part: any) => Buffer.byteLength(JSON.stringify(unpackContent(part.packed))))));
    expect(maxDecodedPartition).toBeLessThan(2 * 1024 * 1024);
    expect(maxDecodedPartition).toBeLessThan(Buffer.byteLength(JSON.stringify(data)) / 10);
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
