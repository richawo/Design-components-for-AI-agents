"use client";

import { usePathname } from "next/navigation";

/** Every page has a Markdown twin at the same path plus `.md`. */
export function markdownHref(pathname: string) {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/index.md" : `${p}.md`;
}

/** `<link rel="alternate" type="text/markdown">` for the current page; React hoists it into <head>. */
export function MarkdownAlternate() {
  const pathname = usePathname();
  return <link rel="alternate" type="text/markdown" href={markdownHref(pathname)} />;
}

export function MarkdownLink({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <a href={markdownHref(pathname)} className={className}>
      View this page as Markdown
    </a>
  );
}
