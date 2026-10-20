"use client";
import { useSiteI18n } from "@/components/site/site-i18n";

import { usePathname } from "next/navigation";
import { routeLocale, unlocalizePath } from "@/lib/i18n/routing";

/** Every page has a Markdown twin at the same path plus `.md`. */
export function markdownHref(pathname: string) {
  const p = pathname.replace(/\/+$/, "");
  if (unlocalizePath(p || "/") === "/") return routeLocale(p) === "en" ? "/index.md" : `${p}/index.md`;
  return `${p}.md`;
}

/** `<link rel="alternate" type="text/markdown">` for the current page; React hoists it into <head>. */
export function MarkdownAlternate() {
  const { localize } = useSiteI18n();

  const pathname = usePathname();
  return localize(<link rel="alternate" type="text/markdown" href={markdownHref(pathname)} />);
}

export function MarkdownLink({ className = "", label = "View this page as Markdown" }: { className?: string; label?: string }) {
  const { localize } = useSiteI18n();

  const pathname = usePathname();
  return (
    localize(<a href={markdownHref(pathname)} className={className}>
      {label}
    </a>)
  );
}
