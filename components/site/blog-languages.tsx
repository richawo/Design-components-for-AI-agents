import { blogAlternates, type HubOptions } from "@/lib/blog/seo";
import { blogLocales, blogText } from "@/lib/blog/runtime";
import { SiteLanguageLinks } from "./site-i18n";

export function BlogLanguages({ locale = "en", sourceSlug, page = 1, category, footer = false }: HubOptions & { sourceSlug?: string; footer?: boolean }) {
  const alternates = blogAlternates({ sourceSlug, page, category });
  const links = blogLocales().filter((l) => alternates[l.hreflang]).map((language) => (
    <a key={language.code} href={new URL(alternates[language.hreflang]).pathname} hrefLang={language.hreflang} lang={language.htmlLang} dir={language.direction} aria-current={language.code === locale ? "page" : undefined} className="rounded-sm text-site-fg-2 underline-offset-4 transition-colors hover:text-site-fg hover:underline aria-[current=page]:text-site-fg">
      {language.label}
    </a>
  ));
  if (links.length < 2) return null;
  if (footer) return <nav aria-label={blogText("Language editions", locale)} className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-6 text-[13px]"><p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-site-fg-3">{blogText("Language editions", locale)}</p><div className="flex flex-wrap gap-x-5 gap-y-3">{links}</div></nav>;
  return <SiteLanguageLinks links={alternates} />;
}
