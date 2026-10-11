import type { Metadata } from "next";
import { allPosts, type PostMeta } from "@/lib/content";
import { absoluteUrl, site } from "@/lib/site";
import { blogConfig, blogLocales, blogPath, blogFeedPath, blogText } from "./runtime";
import { localeByCode } from "./locales.mjs";

export const PAGE_SIZE = 12;
export const MIN_INDEXED_TOPIC_POSTS = 3;
export type HubOptions = { locale?: string; page?: number; category?: string };

export function hubPath({ locale = "en", page = 1, category }: HubOptions = {}) {
  return blogPath(locale) + (category ? `/category/${category}` : "") + (page > 1 ? `/page/${page}` : "");
}
export function hubInfo(options: HubOptions = {}) {
  const { locale = "en", page = 1, category } = options;
  const config = blogConfig(locale);
  const topic = category ? config?.categories[category] : undefined;
  if (!config || (category && !topic) || !Number.isInteger(page) || page < 1) return null;
  const all = allPosts(locale).filter((post) => !category || post.categoryKey === category);
  const pages = Math.ceil(all.length / PAGE_SIZE);
  if (!pages || page > pages) return null;
  const title = (topic ? `${topic.name}: ${config.seoTitle ?? config.title}` : config.seoTitle ?? config.title) + (page > 1 ? ` (${blogText("Page", locale)} ${page})` : "");
  return { locale, page, category, config, topic, all, pages, posts: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), title, description: topic?.description ?? config.description, path: hubPath(options), indexable: !category || all.filter((post) => !post.noindex).length >= MIN_INDEXED_TOPIC_POSTS, lastModified: all.map((post) => post.dateModified).sort().at(-1) };
}

export function blogAlternates(options: HubOptions & { sourceSlug?: string } = {}) {
  const languages: Record<string, string> = {};
  for (const locale of blogLocales()) {
    const post = options.sourceSlug ? allPosts(locale.code).find((p) => p.sourceSlug === options.sourceSlug) : undefined;
    if (options.sourceSlug && !post) continue;
    if (!options.sourceSlug && !hubInfo({ ...options, locale: locale.code })) continue;
    languages[locale.hreflang] = absoluteUrl(post ? blogPath(locale.code, post.slug) : hubPath({ ...options, locale: locale.code }));
  }
  if (languages.en) languages["x-default"] = languages.en;
  return languages;
}

const image = (path: string, alt: string) => ({ url: absoluteUrl(path), width: 1200, height: 630, type: "image/png", alt });
export function hubMetadata(options: HubOptions = {}): Metadata {
  const info = hubInfo(options);
  if (!info) return { robots: { index: false, follow: true } };
  const locale = localeByCode(info.locale)!;
  const social = image("/blog-images/blog.png", info.config.heading);
  return {
    title: { absolute: `${info.title} | ${site.name}` }, description: info.description,
    robots: { index: info.indexable, follow: true, "max-image-preview": "large" },
    alternates: { canonical: info.path, languages: blogAlternates(options), types: { "application/rss+xml": blogFeedPath(info.locale), "text/markdown": `${info.path}.md` } },
    openGraph: { type: "website", siteName: site.name, title: info.title, description: info.description, url: absoluteUrl(info.path), locale: locale.ogLocale, alternateLocale: blogLocales().filter((l) => l.code !== info.locale).map((l) => l.ogLocale), images: [social] },
    twitter: { card: "summary_large_image", title: info.title, description: info.description, images: [{ url: social.url, alt: social.alt }] },
  };
}

export function articleMetadata(slug: string, locale = "en"): Metadata {
  const post = allPosts(locale).find((p) => p.slug === slug || p.sourceSlug === slug);
  if (!post) return { robots: { index: false, follow: true } };
  const language = localeByCode(locale)!;
  const path = blogPath(locale, post.slug), social = image(post.image, post.imageAlt);
  return {
    title: { absolute: post.seoTitle }, description: post.seoDescription, keywords: post.keywords,
    authors: [{ name: post.author, url: blogConfig(locale)?.author.url }],
    robots: { index: !post.noindex, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    alternates: { canonical: path, languages: blogAlternates({ sourceSlug: post.sourceSlug }), types: { "text/markdown": `${path}.md`, "application/rss+xml": blogFeedPath(locale) } },
    openGraph: { type: "article", siteName: site.name, title: post.seoTitle, description: post.seoDescription, url: absoluteUrl(path), locale: language.ogLocale, alternateLocale: blogLocales().filter((l) => l.code !== locale).map((l) => l.ogLocale), publishedTime: post.date, modifiedTime: post.dateModified, authors: [blogConfig(locale)?.author.url ?? site.url], section: post.category, tags: post.keywords, images: [social] },
    twitter: { card: "summary_large_image", title: post.seoTitle, description: post.seoDescription, images: [{ url: social.url, alt: social.alt }] },
  };
}

export const publisher = {
  "@type": "Organization", "@id": absoluteUrl("/#organization"), name: site.name, url: site.url,
  logo: { "@type": "ImageObject", url: absoluteUrl("/blog-images/logo.png"), width: 512, height: 512 },
  sameAs: [site.github], parentOrganization: { "@type": "Organization", name: "Yaps", url: "https://www.yaps.ai" },
};

export function articleJsonLd(post: PostMeta, locale: string, wordCount: number, faqs: { q: string; a: string }[]) {
  const config = blogConfig(locale)!, url = absoluteUrl(blogPath(locale, post.slug)), language = localeByCode(locale)!.htmlLang;
  const data: object[] = [
    { "@context": "https://schema.org", "@type": "BlogPosting", "@id": `${url}#article`, headline: post.title, description: post.description, datePublished: post.date, dateModified: post.dateModified, wordCount, inLanguage: language, articleSection: post.category, keywords: post.keywords.join(", "), url, image: { "@type": "ImageObject", url: absoluteUrl(post.image), width: 1200, height: 630 }, isAccessibleForFree: true, author: { "@type": config.author.type, name: config.author.name, url: config.author.url, description: config.author.bio, sameAs: config.author.sameAs }, publisher, mainEntityOfPage: { "@type": "WebPage", "@id": url }, isPartOf: { "@type": "Blog", "@id": absoluteUrl(blogPath(locale)), name: config.title } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: blogText("Home", locale), item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: blogText("Blog", locale), item: absoluteUrl(blogPath(locale)) },
      { "@type": "ListItem", position: 3, name: post.category, item: absoluteUrl(hubPath({ locale, category: post.categoryKey })) },
      { "@type": "ListItem", position: 4, name: post.title, item: url },
    ] },
  ];
  if (faqs.length) data.push({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: language, mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) });
  return data;
}

export function hubJsonLd(options: HubOptions = {}) {
  const info = hubInfo(options);
  if (!info) return [];
  const url = absoluteUrl(info.path), language = localeByCode(info.locale)!.htmlLang;
  const items = info.posts.map((post, index) => ({ "@type": "ListItem", position: (info.page - 1) * PAGE_SIZE + index + 1, name: post.title, url: absoluteUrl(blogPath(info.locale, post.slug)) }));
  return [
    { "@context": "https://schema.org", "@type": info.category ? "CollectionPage" : "Blog", name: info.title, description: info.description, url, inLanguage: language, publisher, ...(info.category ? { mainEntity: { "@type": "ItemList", numberOfItems: info.all.length, itemListElement: items } } : { blogPost: info.posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: absoluteUrl(blogPath(info.locale, post.slug)), datePublished: post.date, dateModified: post.dateModified, image: absoluteUrl(post.image), inLanguage: language })) }) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: blogText("Home", info.locale), item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: blogText("Blog", info.locale), item: absoluteUrl(blogPath(info.locale)) },
      ...(info.category || info.page > 1 ? [{ "@type": "ListItem", position: 3, name: info.title, item: url }] : []),
    ] },
  ];
}
