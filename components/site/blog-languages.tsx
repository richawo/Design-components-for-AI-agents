import { blogAlternates, type HubOptions } from "@/lib/blog/seo";
import { blogLocales, blogText } from "@/lib/blog/runtime";
import { localeByCode } from "@/lib/blog/locales.mjs";

export function BlogLanguages({ locale = "en", sourceSlug, page = 1, category, footer = false }: HubOptions & { sourceSlug?: string; footer?: boolean }) {
  const alternates = blogAlternates({ sourceSlug, page, category });
  const links = blogLocales().filter((l) => alternates[l.hreflang]).map((language) => (
    <a key={language.code} href={new URL(alternates[language.hreflang]).pathname} hrefLang={language.hreflang} lang={language.htmlLang} dir={language.direction} aria-current={language.code === locale ? "page" : undefined} className="rounded-sm text-site-fg-2 underline-offset-4 transition-colors hover:text-site-fg hover:underline aria-[current=page]:text-site-fg">
      {language.label}
    </a>
  ));
  if (links.length < 2) return null;
  if (footer) return <nav aria-label={blogText("Language editions", locale)} className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-6 text-[13px]"><p className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-site-fg-3">{blogText("Language editions", locale)}</p><div className="flex flex-wrap gap-x-5 gap-y-3">{links}</div></nav>;
  return <details className="blog-language-menu relative z-20 ms-auto w-fit text-[13px]"><summary aria-label={blogText("Choose language", locale)} className="cursor-pointer rounded-sm py-2 text-site-fg-2 marker:text-site-fg-3 hover:text-site-fg">{localeByCode(locale)?.label}</summary><nav aria-label={blogText("Choose language", locale)} className="absolute end-0 top-full grid max-h-80 min-w-64 grid-cols-2 gap-x-5 gap-y-3 overflow-auto rounded-xl border border-white/15 bg-[#101014] p-5 shadow-xl">{links}</nav></details>;
}
