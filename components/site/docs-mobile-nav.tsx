"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { DocsNav } from "./docs-nav";

export function DocsMobileNav({ groups }: { groups: { section: string; docs: { slug: string; title: string }[] }[] }) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (details.current?.open) {
      details.current.open = false;
      document.querySelector<HTMLElement>("article h1")?.focus({ preventScroll: true });
    }
  }, [pathname]);
  const current = groups.flatMap((group) => group.docs).find((doc) => pathname === (doc.slug === "introduction" ? "/docs" : `/docs/${doc.slug}`));
  return <details ref={details} className="site-disclosure site-surface group rounded-[18px] lg:hidden">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[18px] px-4 py-3 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
      <span><span className="mr-2 text-site-fg-3">Docs</span>{current?.title ?? "Documentation"}</span>
      <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-site-fg-2 transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    </summary>
    <div className="border-t border-white/[0.06] px-3 pb-4 pt-4"><DocsNav groups={groups} scope="mobile" /></div>
  </details>;
}
