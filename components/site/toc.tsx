"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Heading } from "@/lib/content";

export function Toc({ headings, label = "On this page" }: { headings: Heading[]; label?: string }) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);
  // The active heading is the last one that has scrolled past the header.
  // Measuring on scroll (not IntersectionObserver) stays right after big
  // jumps, when no heading happens to be inside an observed band.
  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 120;
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top - line <= 0) current = el.id;
        else break;
      }
      // At the very bottom, the last heading may never reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els[els.length - 1].id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);
  if (!headings.length) return null;
  return (
    <nav aria-label={label}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{label}</p>
      <ol className="mt-4 space-y-1 border-l border-white/[0.08]">
        {headings.map((h) => (
          <li key={h.id} className="relative">
            {active === h.id && (
              <motion.span
                layoutId="toc-active"
                aria-hidden="true"
                className="absolute -left-px inset-y-0 w-0.5 rounded-full bg-site-accent shadow-[0_0_10px_#ff7a45]"
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              />
            )}
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? "location" : undefined}
              className={`block py-1 text-[14px] leading-snug transition-colors duration-200 ${h.level === 3 ? "pl-7" : "pl-4"} ${active === h.id ? "font-medium text-site-fg" : "text-site-fg-3 hover:text-site-fg"}`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
