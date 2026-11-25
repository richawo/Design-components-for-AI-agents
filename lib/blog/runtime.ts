import "server-only";
import packed from "@/registry/__generated__/content-packed.json";
import productionPacked from "@design-yaps/public-content-runtime";
import { createPublicContent, type PartitionedPublicContent } from "../../scripts/lib/public-content-partitions.mjs";
import { LOCALES, localeByCode } from "./locales.mjs";

export type BlogConfig = {
  title: string; seoTitle?: string; description: string; seoDescription?: string; heading: string; intro: string;
  author: { name: string; type: "Person" | "Organization"; url: string; bio: string; sameAs?: string[] };
  categories: Record<string, { name: string; description: string; seoTitle?: string; seoDescription?: string }>;
  cta: { heading: string; body: string };
};
export type BlogBundle = {
  blog: Record<string, string>; docs: Record<string, string>;
  localizedBlog?: Record<string, Record<string, string>>;
  config?: BlogConfig; localizedConfig?: Record<string, BlogConfig>;
  ui?: Record<string, Record<string, string>>;
  blogImages?: Record<string, { width: number; height: number }>;
};
// Metadata enumeration does not inflate article bodies. Keep at most the
// requested article partitions (each below 2 MiB) inside a long-lived isolate.
export const BLOG_DATA = createPublicContent((process.env.NODE_ENV === "production" ? productionPacked : packed) as PartitionedPublicContent) as BlogBundle;
export const blogFiles = (locale = "en") => locale === "en" ? BLOG_DATA.blog : BLOG_DATA.localizedBlog?.[locale] ?? {};
export const blogConfig = (locale = "en") => (locale === "en" ? BLOG_DATA.config : BLOG_DATA.localizedConfig?.[locale]) ?? BLOG_DATA.config;
export const blogUI = (locale = "en") => BLOG_DATA.ui?.[locale] ?? {};
export const blogText = (text: string, locale = "en") => blogUI(locale)[text] ?? text;
// Edition manifests are immutable. SEO calls this for every reciprocal
// alternate; enumerate the lazy file descriptors once, then return a snapshot.
const availableBlogLocales = LOCALES.filter((locale) => Object.keys(blogFiles(locale.code)).length > 0);
export const blogLocales = () => [...availableBlogLocales];
export const localePrefix = (locale = "en") => locale === "en" ? "" : `/${locale}`;
export const blogPath = (locale = "en", slug?: string) => `${localePrefix(locale)}/blog${slug ? `/${slug}` : ""}`;
export const blogFeedPath = (locale = "en") => `${blogPath(locale)}/rss.xml`;
export const validBlogLocale = (locale: string) => !!localeByCode(locale) && blogLocales().some((l) => l.code === locale);
