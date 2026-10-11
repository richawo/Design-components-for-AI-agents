import "server-only";
import bundled from "@/registry/__generated__/content.json";
import { LOCALES, localeByCode } from "./locales.mjs";

export type BlogConfig = {
  title: string; seoTitle?: string; description: string; heading: string; intro: string;
  author: { name: string; type: "Person" | "Organization"; url: string; bio: string; sameAs?: string[] };
  categories: Record<string, { name: string; description: string }>;
  cta: { heading: string; body: string };
};
export type BlogBundle = {
  blog: Record<string, string>; docs: Record<string, string>;
  localizedBlog?: Record<string, Record<string, string>>;
  config?: BlogConfig; localizedConfig?: Record<string, BlogConfig>;
  ui?: Record<string, Record<string, string>>;
  blogImages?: Record<string, { width: number; height: number }>;
};
export const BLOG_DATA = bundled as unknown as BlogBundle;
export const blogFiles = (locale = "en") => locale === "en" ? BLOG_DATA.blog : BLOG_DATA.localizedBlog?.[locale] ?? {};
export const blogConfig = (locale = "en") => (locale === "en" ? BLOG_DATA.config : BLOG_DATA.localizedConfig?.[locale]) ?? BLOG_DATA.config;
export const blogUI = (locale = "en") => BLOG_DATA.ui?.[locale] ?? {};
export const blogText = (text: string, locale = "en") => blogUI(locale)[text] ?? text;
export const blogLocales = () => LOCALES.filter((locale) => Object.keys(blogFiles(locale.code)).length > 0);
export const localePrefix = (locale = "en") => locale === "en" ? "" : `/${locale}`;
export const blogPath = (locale = "en", slug?: string) => `${localePrefix(locale)}/blog${slug ? `/${slug}` : ""}`;
export const blogFeedPath = (locale = "en") => `${blogPath(locale)}/rss.xml`;
export const validBlogLocale = (locale: string) => !!localeByCode(locale) && blogLocales().some((l) => l.code === locale);
