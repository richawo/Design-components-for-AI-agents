import { LOCALES, localeByCode } from "@/lib/blog/locales.mjs";

export { LOCALES };
export const SITE_ROUTES = ["components", "blocks", "categories", "pricing", "docs", "account", "blog", "preview"];
export const SITE_LOCALE_COOKIE = "design-locale";
// Chromium omits Maltese Intl data while Node includes it. Use the same
// numeric/date fallback on both sides; all visible copy still uses Maltese.
export const formatLocale = (locale: string) => locale === "mt" ? "en-GB" : localeByCode(locale)?.htmlLang ?? locale;

export function preferredLocale(cookies: string | null) {
  const value = cookies?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SITE_LOCALE_COOKIE}=`))?.slice(SITE_LOCALE_COOKIE.length + 1);
  return localeByCode(value ?? "en")?.code ?? "en";
}

export function routeLocale(path: string) {
  return localeByCode(path.split(/[/?#]/)[1])?.code ?? "en";
}

export function unlocalizePath(path: string) {
  const [, pathname, suffix] = /^([^?#]*)([\s\S]*)$/.exec(path)!;
  const segment = pathname.split("/")[1];
  const clean = localeByCode(segment) ? pathname.replace(new RegExp(`^/${segment}(?=/|$)`), "") || "/" : pathname;
  return clean + suffix;
}

/** Only human pages have language editions. Assets, APIs and install URLs stay exact. */
export function localizePath(path: string, locale: string) {
  if (!path.startsWith("/") || path.startsWith("//") || !localeByCode(locale)) return path;
  const bare = unlocalizePath(path);
  const pathname = bare.split(/[?#]/)[0];
  if (/\.[a-z0-9]+$/i.test(pathname)) return path;
  if (pathname !== "/" && !SITE_ROUTES.includes(pathname.split("/")[1])) return path;
  return locale === "en" ? bare : `/${locale}${pathname === "/" ? bare.slice(1) : bare}`;
}
