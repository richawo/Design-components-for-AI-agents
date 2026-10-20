import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";
import { LOCALES, localizePath } from "./routing";
import { serverI18n } from "./server";

export function siteAlternates(path: string) {
  return Object.fromEntries([...LOCALES.map((locale) => [locale.hreflang, absoluteUrl(localizePath(path, locale.code))]), ["x-default", absoluteUrl(localizePath(path, "en"))]]);
}

export async function localizedMetadata(metadata: Metadata, locale: string, path: string): Promise<Metadata> {
  const { t } = await serverI18n(locale);
  const language = LOCALES.find((item) => item.code === locale)!;
  const title = typeof metadata.title === "string" ? t(metadata.title) : metadata.title && "absolute" in metadata.title ? { absolute: t(metadata.title.absolute!) } : metadata.title;
  return {
    ...metadata, title, description: metadata.description ? t(metadata.description) : undefined,
    alternates: { ...metadata.alternates, canonical: localizePath(path, locale), languages: siteAlternates(path), types: { "text/markdown": path === "/" ? `/${locale}/index.md` : `${localizePath(path, locale)}.md` } },
    openGraph: { ...metadata.openGraph, title: typeof title === "string" ? title : title && "absolute" in title ? title.absolute : undefined, description: metadata.description ? t(metadata.description) : undefined, url: absoluteUrl(localizePath(path, locale)), locale: language.ogLocale, alternateLocale: LOCALES.filter((item) => item.code !== locale).map((item) => item.ogLocale) },
  };
}
