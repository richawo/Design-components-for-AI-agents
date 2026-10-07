"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { site } from "@/lib/site";

const NAV = [
  { href: "/components", label: "Components" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${scrolled || open ? "border-white/[0.07] bg-black/75 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-transparent"}`}
    >
      <div className="mx-auto flex h-16 max-w-[80rem] items-center justify-between gap-6 px-5 sm:px-8">
        <div className="flex items-center gap-10">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-1.5 text-[14px] transition-colors ${active ? "text-site-fg" : "text-site-fg-2 hover:text-site-fg"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <a
            href={site.github}
            className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[14px] text-site-fg-2 transition-colors hover:text-site-fg"
          >
            <GitHubMark className="size-4" />
            GitHub
          </a>
          <Link href="/account" className="inline-flex h-9 items-center rounded-full px-3 text-[14px] text-site-fg-2 transition-colors hover:text-site-fg">
            Sign in
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[14px] font-medium text-black shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_24px_-8px_rgba(255,255,255,0.35)] transition hover:bg-white/90"
          >
            Get Pro
          </Link>
        </div>
        <button
          type="button"
          className="relative flex size-10 items-center justify-center rounded-full border border-white/10 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`absolute h-px w-4 bg-white transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-[3px]"}`} />
          <span className={`absolute h-px w-4 bg-white transition-transform duration-300 ${open ? "-rotate-45" : "translate-y-[3px]"}`} />
        </button>
      </div>

      <div
        id="mobile-nav"
        className={`fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col bg-black px-5 pb-8 pt-4 transition-[opacity,visibility] duration-300 md:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ transitionDelay: open ? `${40 + i * 40}ms` : "0ms" }}
              className={`border-b border-white/[0.07] py-4 text-2xl font-medium tracking-[-0.03em] text-site-fg transition-all duration-500 ${open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid grid-cols-2 gap-3">
          <a href={site.github} className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/12 text-[15px] text-site-fg">
            <GitHubMark className="size-4" /> GitHub
          </a>
          <Link href="/pricing" className="flex h-12 items-center justify-center rounded-full bg-white text-[15px] font-medium text-black">
            Get Pro
          </Link>
        </div>
      </div>
    </header>
  );
}

export function GitHubMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
