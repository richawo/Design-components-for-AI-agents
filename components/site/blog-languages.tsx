import { blogAlternates, type HubOptions } from "@/lib/blog/seo";
import { blogLocales, blogText } from "@/lib/blog/runtime";
import { localeByCode } from "@/lib/blog/locales.mjs";
import { ChevronDown, Globe2 } from "lucide-react";

export function BlogLanguages({ locale = "en", sourceSlug, page = 1, category, footer = false }: HubOptions & { sourceSlug?: string; footer?: boolean }) {
  const alternates = blogAlternates({ sourceSlug, page, category });
  const links = blogLocales().filter((l) => alternates[l.hreflang]).map((language) => (
    <a key={language.code} href={new URL(alternates[language.hreflang]).pathname} hrefLang={language.hreflang} lang={language.htmlLang} dir={language.direction} aria-current={language.code === locale ? "page" : undefined} className="rounded-sm text-site-fg-2 underline-offset-4 transition-colors hover:text-site-fg hover:underline aria-[current=page]:text-site-fg">
      {language.label}
    </a>
  ));
  if (links.length < 2) return null;
  if (footer) return <nav aria-label={blogText("Language editions", locale)} className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-6 text-[13px]"><p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-site-fg-3">{blogText("Language editions", locale)}</p><div className="flex flex-wrap gap-x-5 gap-y-3">{links}</div></nav>;
  return <details className="blog-language-menu group/languages relative z-20 ms-auto w-fit text-[13px]">
    <summary role="button" aria-label={`${blogText("Choose language", locale)}: ${localeByCode(locale)?.label}`} className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/15 px-3 text-site-fg-2 transition-colors hover:border-white/30 hover:text-site-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
      <Globe2 size={16} aria-hidden="true" /><span>{localeByCode(locale)?.label}</span><ChevronDown size={14} aria-hidden="true" className="transition-transform group-open/languages:rotate-180" />
    </summary>
    <nav aria-label={blogText("Choose language", locale)} className="absolute end-0 top-full mt-2 grid max-h-80 w-[min(20rem,calc(100vw-2.5rem))] grid-cols-2 gap-x-5 gap-y-3 overflow-auto rounded-xl border border-white/15 bg-[#101014] p-5 shadow-xl">{links}</nav>
  </details>;
}
