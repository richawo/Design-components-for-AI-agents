import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { bundleBlog, corpusUnits, inlineUnit, postUnits, stableSlugs, type BlogSource } from "../scripts/lib/blog-source.mjs";
import { auditBlog } from "../scripts/lib/blog-audit.mjs";
import { LOCALES, localeByCode } from "../lib/blog/locales.mjs";

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture(): BlogSource {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "design-blog-test-")); scratch.push(base);
  const data = { title: "Fixture design guide for agents", slug: "fixture-guide", description: "A fixture description long enough to check metadata and translation contracts without copying editorial content.", excerpt: "A fixture guide.", date: "2026-10-07", dateModified: "2026-10-11", category: "Guides", author: "Design for AI", keywords: "fixture guide" };
  const content = "## Using a component\n\nUse `Widget()` with **care** and [the docs](/docs/agents).\n\n```tsx\nconst example = 'never translate this';\n```\n\n## Frequently asked questions\n\n### Is this a fixture?\n\nYes, it is.\n";
  return { base, config: { author: { name: "Design for AI" }, categories: { guides: { name: "Guides", description: "Fixture guides." } } }, posts: [{ file: "fixture-guide.md", data, content, raw: matter.stringify(content, data) }] };
}

describe("private blog localization", () => {
  it("uses the same 30 languages, including Brazilian Portuguese and RTL Arabic", () => {
    expect(LOCALES).toHaveLength(30);
    expect(localeByCode("pt-br")?.hreflang).toBe("pt-BR");
    expect(localeByCode("ar")?.direction).toBe("rtl");
  });
  it("protects inline code and never extracts fenced code as a translation unit", () => {
    const source = fixture();
    expect(inlineUnit("Use `Widget()` with **care**.").opaque).toEqual(["<code>Widget()</code>"]);
    expect(postUnits(source.posts[0]).join("\n")).not.toContain("never translate this");
  });
  it("localises standalone image descriptions and escapes attribute quotes", () => {
    const source = fixture();
    source.posts[0].content += '\n![A copper token diagram](/blog-images/example.png)\n';
    source.posts[0].raw = matter.stringify(source.posts[0].content, source.posts[0].data);
    const strings = Object.fromEntries(corpusUnits(source).map((key) => [key, `FR ${key}`]));
    strings["A copper token diagram"] = 'Un schéma "cuivré"';
    for (const dir of ["strings", "slugs"]) fs.mkdirSync(path.join(source.base, "i18n", dir), { recursive: true });
    fs.writeFileSync(path.join(source.base, "i18n/strings/fr.json"), JSON.stringify(strings));
    fs.writeFileSync(path.join(source.base, "i18n/slugs/fr.json"), JSON.stringify({ "fixture-guide": "guide-stable" }));
    const translated = bundleBlog(source).localizedBlog.fr["fixture-guide.md"];
    expect(translated).toContain('alt="Un schéma &quot;cuivré&quot;"');
    expect(translated).toContain('src="/blog-images/example.png"');
  });
  it("preserves published slugs even when the translated title changes", () => {
    const source = fixture();
    expect(stableSlugs(source, localeByCode("fr")!, {}, { "fixture-guide": "guide-stable" })).toEqual({ "fixture-guide": "guide-stable" });
    expect(stableSlugs(source, localeByCode("ja")!, {})).toEqual({ "fixture-guide": "fixture-guide" });
  });
  it("omits incomplete editions and bundles complete ones without mutating code", () => {
    const source = fixture();
    expect(bundleBlog(source).localizedBlog).toEqual({});
    const strings = Object.fromEntries(corpusUnits(source).map((key) => [key, `FR ${key}`]));
    for (const dir of ["strings", "slugs"]) fs.mkdirSync(path.join(source.base, "i18n", dir), { recursive: true });
    fs.writeFileSync(path.join(source.base, "i18n/strings/fr.json"), JSON.stringify(strings));
    fs.writeFileSync(path.join(source.base, "i18n/slugs/fr.json"), JSON.stringify({ "fixture-guide": "guide-stable" }));
    const result = bundleBlog(source);
    expect(Object.keys(result.localizedBlog)).toEqual(["fr"]);
    const parsed = matter(result.localizedBlog.fr["fixture-guide.md"]);
    expect(parsed.data.sourceSlug).toBe("fixture-guide");
    expect(parsed.data.slug).toBe("guide-stable");
    expect(parsed.content).toContain("const example = 'never translate this';");
    expect(parsed.content).toContain("<code>Widget()</code>");
  });
});

describe("blog SEO audit", () => {
  it("uses London publication dates across the BST midnight boundary", () => {
    expect(auditBlog(fixture(), new Date("2026-10-10T23:30:00Z")).errors).toEqual([]);
  });
  it("rejects invalid calendar dates, duplicate titles, extra H1s and broken blog links", () => {
    const source = fixture();
    source.posts[0].data.date = "2026-02-30";
    source.posts[0].content += "\n# Extra title\n\n[Missing](/blog/unpublished)\n";
    source.posts.push({ ...source.posts[0], file: "another.md" });
    const errors = auditBlog(source).errors.join("\n");
    expect(errors).toContain("real YYYY-MM-DD");
    expect(errors).toContain("duplicate title");
    expect(errors).toContain("only H1");
    expect(errors).toContain("unpublished article");
  });
});
