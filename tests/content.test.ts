import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (dir: string) =>
  fs
    .readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: f, ...matter(fs.readFileSync(path.join(root, dir, f), "utf8")) }));

describe("blog posts", () => {
  const posts = read("content/blog");
  it.each(posts.map((p) => [p.file, p] as const))("%s has complete SEO frontmatter", (_, p) => {
    expect(p.data.slug).toBe(p.file.replace(/\.md$/, ""));
    expect(p.data.title.length).toBeLessThanOrEqual(90);
    expect(p.data.description.length).toBeGreaterThan(70);
    expect(p.data.description.length).toBeLessThanOrEqual(170);
    expect(p.data.excerpt).toBeTruthy();
    expect(String(p.data.keywords ?? "")).not.toBe("");
    expect(new Date(p.data.date).toString()).not.toBe("Invalid Date");
  });
});

describe("docs", () => {
  it.each(read("content/docs").map((d) => [d.file, d] as const))("%s has title, description and order", (_, d) => {
    expect(d.data.title).toBeTruthy();
    expect(d.data.description?.length).toBeGreaterThan(40);
    expect(typeof d.data.order).toBe("number");
  });
});
