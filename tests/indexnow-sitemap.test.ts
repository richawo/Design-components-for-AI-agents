import { describe, expect, it } from "vitest";
import { collectSitemapUrls } from "../scripts/lib/indexnow-sitemap.mjs";

const origin = "https://design.yaps.ai";
const fakeFetch = (files: Record<string, string | number>) => (async (url: string | URL | Request) => {
  const file = files[String(url)];
  return new Response(typeof file === "string" ? file : "Missing", { status: typeof file === "number" ? file : typeof file === "string" ? 200 : 404 });
}) as typeof fetch;

describe("IndexNow sitemap traversal", () => {
  it("submits pages from nested indexes, excludes sitemap and alternate/image URLs and deduplicates", async () => {
    const files = {
      [`${origin}/sitemap.xml`]: `<sitemapindex><sitemap><loc>${origin}/sitemaps/en.xml</loc></sitemap><sitemap><loc>${origin}/nested.xml</loc></sitemap></sitemapindex>`,
      [`${origin}/nested.xml`]: `<sitemapindex><sitemap><loc>${origin}/sitemaps/fr.xml</loc></sitemap><sitemap><loc>${origin}/sitemap.xml</loc></sitemap></sitemapindex>`,
      [`${origin}/sitemaps/en.xml`]: `<urlset><url><loc>${origin}/blog</loc><xhtml:link href="${origin}/fr/blog"/><image:loc>${origin}/cover.png</image:loc></url></urlset>`,
      [`${origin}/sitemaps/fr.xml`]: `<urlset><url><loc>${origin}/fr/blog</loc></url><url><loc>${origin}/blog</loc></url></urlset>`,
    };
    expect(await collectSitemapUrls(`${origin}/sitemap.xml`, fakeFetch(files))).toEqual([`${origin}/blog`, `${origin}/fr/blog`]);
  });
  it("fails when a shard is missing instead of sending a partial list", async () => {
    const files = { [`${origin}/sitemap.xml`]: `<sitemapindex><sitemap><loc>${origin}/missing.xml</loc></sitemap></sitemapindex>` };
    await expect(collectSitemapUrls(`${origin}/sitemap.xml`, fakeFetch(files))).rejects.toThrow("404");
  });
  it("rejects off-site sitemaps and pages, and HTML errors disguised as successful responses", async () => {
    for (const body of ["<html>Not found</html>", "<sitemapindex><sitemap><loc>https://other.example/sitemap.xml</loc></sitemap></sitemapindex>", "<urlset><url><loc>https://other.example/blog</loc></url></urlset>"]) {
      await expect(collectSitemapUrls(`${origin}/sitemap.xml`, fakeFetch({ [`${origin}/sitemap.xml`]: body }))).rejects.toThrow();
    }
  });
});
