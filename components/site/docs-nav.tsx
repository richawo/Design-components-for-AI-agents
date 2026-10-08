"use client";

import { motion } from "motion/react";
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
                    aria-current={active ? "page" : undefined}
                    className={`group relative block rounded-xl px-3 py-1.5 text-[14px] transition-colors ${active ? "font-medium text-site-fg" : "text-site-fg-2 hover:bg-white/[0.04] hover:text-site-fg"}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="docs-nav-active"
                        className="absolute inset-0 rounded-xl bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        transition={{ type: "spring", stiffness: 460, damping: 40 }}
                      />
                    )}
                    <span className="relative inline-block transition-transform duration-150 group-active:scale-[0.97]">{d.title}</span>
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
