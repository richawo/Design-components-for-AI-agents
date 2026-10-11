import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allPosts, getPost } from "@/lib/content";
import { blogLocales, blogPath } from "@/lib/blog/runtime";
import { articleMetadata, articleJsonLd, hubMetadata, hubInfo } from "@/lib/blog/seo";
import { blogMarkdown, localeSitemap, rss, sitemapEntries, sitemapIndex } from "@/lib/blog/feeds";
import { absoluteUrl } from "@/lib/site";

describe.skipIf(!allPosts().length)("published multilingual blog SEO", () => {
  it("gives every edition its own canonical, reciprocal alternates and complete social metadata", () => {
    for (const language of blogLocales()) for (const post of allPosts(language.code)) {
      const metadata = articleMetadata(post.slug, language.code);
      expect(metadata.alternates?.canonical).toBe(blogPath(language.code, post.slug));
      const languages = metadata.alternates?.languages as Record<string, string>;
      expect(Object.keys(languages)).toHaveLength(31);
      expect(languages[language.hreflang]).toBe(absoluteUrl(blogPath(language.code, post.slug)));
      expect(languages["x-default"]).toBe(languages.en);
      expect(metadata.openGraph).toMatchObject({ type: "article", locale: language.ogLocale });
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: post.seoTitle });
      expect(post.seoTitle.length).toBeLessThanOrEqual(70);
      expect(post.seoDescription.length).toBeLessThanOrEqual(170);
    }
  });
  it("uses translated article and FAQ text, language and canonical breadcrumb URLs in JSON-LD", async () => {
    for (const language of blogLocales()) {
      const post = await getPost(allPosts(language.code)[0].slug, language.code);
      const data = articleJsonLd(post!.meta, language.code, 700, post!.faqs) as Record<string, any>[];
      expect(data[0]).toMatchObject({ "@type": "BlogPosting", inLanguage: language.htmlLang, headline: post!.meta.title });
      expect(data[0].publisher.logo).toMatchObject({ width: 512, height: 512 });
      expect(data[1].itemListElement.at(-1).item).toBe(absoluteUrl(blogPath(language.code, post!.meta.slug)));
      expect(data[2].mainEntity[0].name).toBe(post!.faqs[0].q);
    }
  });
  it("omits thin topic hubs and noindex resources from search sitemaps", () => {
    for (const language of blogLocales()) {
      const entries = sitemapEntries(language.code), info = hubInfo({ locale: language.code })!;
      for (const key of Object.keys(info.config.categories)) {
        const topic = hubInfo({ locale: language.code, category: key });
        if (!topic || topic.indexable) continue;
        expect(hubMetadata({ locale: language.code, category: key }).robots).toMatchObject({ index: false });
        expect(entries.some((entry) => entry.path === topic.path)).toBe(false);
      }
      expect(entries.some((entry) => /\.md$|rss\.xml$|\/md\/|\/account/.test(entry.path))).toBe(false);
      if (language.code !== "en") expect(entries.every((entry) => entry.path.startsWith(`/${language.code}/blog`))).toBe(true);
    }
  });
  it("keeps translated hub and category search previews concise", () => {
    for (const language of blogLocales()) {
      for (const category of [undefined, ...Object.keys(hubInfo({ locale: language.code })!.config.categories)]) {
        const info = hubInfo({ locale: language.code, category });
        if (!info) continue;
        const metadata = hubMetadata({ locale: language.code, category });
        expect((metadata.title as { absolute: string }).absolute.length).toBeLessThanOrEqual(70);
        expect(metadata.description!.length).toBeLessThanOrEqual(170);
      }
    }
  });
  it("adds procedural markup only for visible steps and keeps their canonical anchors", () => {
    const post = allPosts()[0];
    const steps = [{ name: "Choose a file", text: "Choose the project file.", id: "choose-a-file" }, { name: "Check the result", text: "Check the rendered result.", id: "check-the-result" }];
    const data = articleJsonLd(post, "en", 700, [], steps) as Record<string, any>[];
    const howTo = data.find((item) => item["@type"] === "HowTo");
    expect(howTo).toMatchObject({ inLanguage: "en", name: post.title });
    expect(howTo!.step[1]).toMatchObject({ position: 2, text: steps[1].text, url: `${absoluteUrl(blogPath("en", post.slug))}#check-the-result` });
    expect(articleJsonLd(post, "en", 700, []).some((item: any) => item["@type"] === "HowTo")).toBe(false);
  });
  it("keeps each published procedure tied to its localized visible steps", async () => {
    for (const language of blogLocales()) for (const meta of allPosts(language.code)) {
      const post = (await getPost(meta.slug, language.code))!;
      const data = articleJsonLd(meta, language.code, 700, post.faqs, post.howToSteps) as Record<string, any>[];
      const howTo = data.find((item) => item["@type"] === "HowTo");
      if (!post.howToSteps.length) { expect(howTo).toBeUndefined(); continue; }
      expect(howTo?.inLanguage).toBe(language.htmlLang);
      expect(howTo?.step).toHaveLength(post.howToSteps.length);
      expect(new Set(post.howToSteps.map((step) => step.id)).size).toBe(post.howToSteps.length);
      for (const [index, step] of post.howToSteps.entries()) {
        expect(post.html).toContain(`id="${step.id}"`);
        expect(howTo?.step[index]).toMatchObject({ name: step.name, text: step.text, url: `${absoluteUrl(blogPath(language.code, meta.slug))}#${step.id}` });
      }
      if (meta.editorialCover) expect(meta.displayImage).toBe(`/blog-images/${meta.sourceSlug}.webp`);
    }
  });
  it("emits every language sitemap and reciprocal image/lastmod entries", () => {
    expect(sitemapIndex().match(/<sitemap>/g)).toHaveLength(30);
    for (const language of blogLocales()) {
      const body = localeSitemap(language.code);
      expect(body).toContain('hreflang="x-default"');
      expect(body).toContain('<image:image>');
      expect(body).toContain('<lastmod>');
    }
  });
  it("keeps feeds and Markdown companions in the selected language with canonical provenance", () => {
    for (const language of blogLocales()) {
      const post = allPosts(language.code)[0];
      expect(rss(language.code)).toContain(`<language>${language.htmlLang}</language>`);
      const markdown = blogMarkdown([language.code, post.slug])!;
      expect(markdown.body).toContain(`canonical: ${absoluteUrl(blogPath(language.code, post.slug))}`);
      expect(markdown.body).toContain(`language: ${language.htmlLang}`);
      expect(blogMarkdown([language.code, "not-a-post"])).toBeNull();
      expect(hubInfo({ locale: language.code, page: 999 })).toBeNull();
    }
  });
  it("generates real 1200 by 630 PNG social cards and a 512px publisher logo", () => {
    for (const name of ["blog", ...allPosts().map((post) => post.sourceSlug)]) {
      const bytes = fs.readFileSync(path.join(import.meta.dirname, `../public/blog-images/${name}.png`));
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
    }
  });
});
