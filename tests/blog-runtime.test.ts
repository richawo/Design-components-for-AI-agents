import { describe, expect, it } from "vitest";
import { allPosts, getPost, localizedBlogLink, relatedPosts } from "@/lib/content";
import { blogLocales } from "@/lib/blog/runtime";

describe("blog runtime", () => {
  it("never serves English under an unsupported locale", () => {
    expect(allPosts("not-a-locale")).toEqual([]);
  });
  it.skipIf(!allPosts().length)("ships matching post sets, translated FAQs and local links in every complete language", async () => {
    const source = allPosts().map((post) => post.sourceSlug).sort();
    expect(blogLocales()).toHaveLength(30);
    for (const locale of blogLocales()) {
      expect(allPosts(locale.code).map((post) => post.sourceSlug).sort()).toEqual(source);
      for (const meta of allPosts(locale.code)) {
        const post = await getPost(meta.slug, locale.code);
        expect(post?.faqs.length, `${locale.code}/${meta.slug}`).toBeGreaterThan(0);
        expect(post?.headings.every((heading) => heading.id)).toBe(true);
        expect(relatedPosts(meta.slug, 3, locale.code)).toHaveLength(3);
        if (locale.code !== "en") {
          expect(post?.html).not.toMatch(/href="\/blog\//);
          expect(localizedBlogLink(`/blog/${meta.sourceSlug}`, locale.code)).toBe(`/${locale.code}/blog/${meta.slug}`);
        }
      }
    }
  });
});
