"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { site } from "@/lib/site";

const NAV = [
  { href: "/components", label: "Components" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

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
    <>
      <header
        className={`sticky top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${scrolled || open ? "border-white/[0.07] bg-site-bg/75 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-transparent"}`}
      >
        <div className="mx-auto flex h-16 max-w-[80rem] items-center justify-between gap-6 px-5 sm:px-8">
          <div className="flex items-center gap-10">
            <Logo />
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex" onMouseLeave={() => setHovered(null)}>
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={() => setHovered(item.href)}
                    onFocus={() => setHovered(item.href)}
                    onBlur={() => setHovered(null)}
                    className={`relative isolate rounded-full px-3.5 py-1.5 text-[14px] transition-[color,scale] duration-200 active:scale-[0.96] ${active ? "text-site-fg" : "text-site-fg-2 hover:text-site-fg"}`}
                  >
                    <AnimatePresence>
                      {hovered === item.href && (
                        <motion.span
                          layoutId="site-nav-hover"
                          className="absolute inset-0 -z-10 rounded-full bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.18 } }}
                          transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.6 }}
                        />
                      )}
                    </AnimatePresence>
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="site-nav-active"
                        aria-hidden="true"
                        className="absolute inset-x-3.5 -bottom-[15px] h-px bg-site-accent"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <a
              href={site.github}
              className="site-btn site-btn-ghost h-9 px-3 text-[14px] font-normal"
            >
              <GitHubMark className="size-4" />
              GitHub
            </a>
            <Link href="/account" className="site-btn site-btn-ghost h-9 px-3 text-[14px] font-normal">
              Sign in
            </Link>
            <Link
              href="/pricing"
              className="site-btn site-btn-accent ml-1 h-9 px-4 text-[14px]"
            >
              Get Pro
            </Link>
          </div>
          <button
            type="button"
            className="relative flex size-10 items-center justify-center rounded-full border border-white/10 transition duration-150 active:scale-95 active:bg-white/[0.06] md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`absolute h-px w-4 bg-site-fg transition-transform duration-300 ease-site ${open ? "rotate-45" : "-translate-y-[3px]"}`} />
            <span className={`absolute h-px w-4 bg-site-fg transition-transform duration-300 ease-site ${open ? "-rotate-45" : "translate-y-[3px]"}`} />
          </button>
        </div>
      </header>

      {/* A sibling of the header, not a child: the header's backdrop-filter would
          otherwise become this fixed panel's containing block and collapse it. */}
      <div
        id="mobile-nav"
        className={`fixed inset-x-0 bottom-0 top-16 z-[45] flex flex-col bg-site-bg px-5 pb-8 pt-4 transition-[opacity,visibility] duration-300 md:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              style={{ transitionDelay: open ? `${40 + i * 50}ms` : "0ms" }}
              className={`flex items-center justify-between border-b border-white/[0.07] py-4 text-2xl font-medium tracking-[-0.03em] transition-[translate,opacity,filter,color] duration-500 ease-site active:text-site-fg-2 aria-[current=page]:text-site-fg ${open ? "translate-y-0 text-site-fg opacity-100 blur-0" : "translate-y-3 text-site-fg-2 opacity-0 blur-[4px]"}`}
            >
              {item.label}
              {isActive(pathname, item.href) && <span aria-hidden="true" className="size-1.5 rounded-full bg-site-accent" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid grid-cols-2 gap-3">
          <Link href="/account" className="site-btn site-btn-secondary col-span-2 h-12 text-[15px]">
            Sign in
          </Link>
          <a href={site.github} className="site-btn site-btn-secondary h-12 text-[15px]">
            <GitHubMark className="size-4" /> GitHub
          </a>
          <Link href="/pricing" className="site-btn site-btn-accent h-12 text-[15px]">
            Get Pro
          </Link>
        </div>
      </div>
    </>
  );
}

export function GitHubMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
