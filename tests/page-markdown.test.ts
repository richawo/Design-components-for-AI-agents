import { describe, expect, it } from "vitest";
import { markdownForPage, markdownPagePaths } from "@/lib/page-markdown";

describe("Markdown twins of every page", () => {
  const paths = markdownPagePaths();

  it("covers the main pages", () => {
    for (const p of ["index", "components", "pricing", "docs", "blog", "account"]) expect(paths).toContain(p);
    expect(paths.some((p) => p.startsWith("docs/"))).toBe(true);
    expect(paths.some((p) => p.startsWith("categories/"))).toBe(true);
  });

  it.each(paths)("%s renders with frontmatter and a heading", async (p) => {
    const md = await markdownForPage(p);
    expect(md).toBeTruthy();
    expect(md!.startsWith("---\n")).toBe(true);
    expect(md).toMatch(/\ncanonical: https?:\/\/\S+/);
    expect(md).toMatch(/\n# \S/);
  });

  it("returns null for unknown pages", async () => {
    expect(await markdownForPage("nope")).toBeNull();
    expect(await markdownForPage("docs/nope")).toBeNull();
    expect(await markdownForPage("categories/nope")).toBeNull();
  });

  it("never leaks Pro source into category or index pages", async () => {
    const md = await markdownForPage("components");
    expect(md).not.toMatch(/```tsx/);
  });
});
