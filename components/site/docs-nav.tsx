"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DocsNav({ groups }: { groups: { section: string; docs: { slug: string; title: string }[] }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Docs" className="space-y-7">
      {groups.map((g) => (
        <div key={g.section}>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{g.section}</p>
          <ul className="mt-3 space-y-0.5">
            {g.docs.map((d) => {
              const href = d.slug === "introduction" ? "/docs" : `/docs/${d.slug}`;
              const active = pathname === href;
              return (
                <li key={d.slug}>
                  <Link
                    href={href}
                    className={`block rounded-xl px-3 py-1.5 text-[14px] transition-colors ${active ? "bg-white/[0.07] font-medium text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-site-fg-2 hover:bg-white/[0.04] hover:text-site-fg"}`}
                  >
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
