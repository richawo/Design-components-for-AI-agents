import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { MarkdownAlternate } from "@/components/site/markdown-link";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-grain flex min-h-dvh flex-col bg-black text-site-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <MarkdownAlternate />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
