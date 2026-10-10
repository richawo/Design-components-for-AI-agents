export type BlogLocale = { code: string; htmlLang: string; hreflang: string; ogLocale: string; label: string; latinSlugs: boolean; translateAs: string; direction: "ltr" | "rtl" };
export const LOCALES: BlogLocale[];
export function localeByCode(code: string): BlogLocale | undefined;
export function asciiSlug(text: string): string;
