"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/content";

export function Toc({ headings, label = "On this page" }: { headings: Heading[]; label?: string }) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);
  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [headings]);
  if (!headings.length) return null;
  return (
    <nav aria-label={label}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{label}</p>
      <ol className="mt-4 space-y-1 border-l border-white/[0.08]">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`-ml-px block border-l-2 py-1 text-[14px] leading-snug transition-colors ${h.level === 3 ? "pl-7" : "pl-4"} ${active === h.id ? "border-site-accent font-medium text-site-fg" : "border-transparent text-site-fg-3 hover:text-site-fg"}`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
