import { blogUI } from "@/lib/blog/runtime";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { MarkdownAlternate } from "@/components/site/markdown-link";
import { RevealObserver } from "@/components/site/reveal-observer";

export function SiteShell({ children, locale = "en" }: { children: React.ReactNode; locale?: string }) {
  const copy = blogUI(locale);
  const t = (text: string) => copy[text] ?? text;
  return (
    <div className="site-grain flex min-h-dvh flex-col bg-site-bg text-site-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        {t("Skip to content")}
      </a>
      <MarkdownAlternate />
      <SiteHeader locale={locale} copy={copy} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} copy={copy} />
      <RevealObserver />
    </div>
  );
}
