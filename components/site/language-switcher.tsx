"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Check, Globe2 } from "lucide-react";
import { LOCALES, SITE_LOCALE_COOKIE, localizePath, unlocalizePath } from "@/lib/i18n/routing";
import { useLanguageLinks, useSiteI18n } from "./site-i18n";

const remember = (locale: string) => { document.cookie = `${SITE_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`; };

export function LanguageSwitcher() {
  const { locale, t } = useSiteI18n();
  const pathname = usePathname();
  const alternates = useLanguageLinks();
  const [open, setOpen] = useState(false);
  const [suffix, setSuffix] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { remember(locale); }, [locale]);
  useEffect(() => { setOpen(false); setSuffix(window.location.search + window.location.hash); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    root.current?.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("pointerdown", outside); root.current?.removeEventListener("keydown", keydown); };
  }, [open]);
  const current = LOCALES.find((language) => language.code === locale)!;
  const target = (code: string) => {
    const language = LOCALES.find((item) => item.code === code)!;
    if (alternates.path === pathname && alternates.links[language.hreflang]) return new URL(alternates.links[language.hreflang], "https://design.yaps.ai").pathname;
    const path = unlocalizePath(pathname);
    return localizePath(path.startsWith("/blog/") && !/^\/blog\/(?:category|page)\//.test(path) ? "/blog" : path, code);
  };
  return <div ref={root} data-language-switcher className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={button} type="button" aria-label={`${t("Choose language")}: ${current.label}`} aria-expanded={open} aria-controls={id} className="site-btn site-btn-ghost min-h-11 gap-1.5 px-2.5 text-[13px]" onClick={() => { setSuffix(window.location.search + window.location.hash); setOpen(!open); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>("nav a")?.focus()); } }}>
      <Globe2 className="size-4" aria-hidden="true" /><span className="uppercase">{locale === "zh-hans" ? "ZH" : locale === "pt-br" ? "PT" : locale}</span><ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    <nav id={id} hidden={!open} aria-label={t("Choose language")} className="absolute end-0 top-full z-[70] mt-2 max-h-[min(32rem,calc(100dvh-6rem))] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-white/15 bg-[#101014] p-3 shadow-2xl">
      <p className="px-3 pb-3 pt-1 text-xs text-site-fg-3">{t("Choose language")}</p>
      <div className="grid grid-cols-2 gap-1">{LOCALES.map((language) => <a key={language.code} href={target(language.code) + suffix} hrefLang={language.hreflang} lang={language.htmlLang} dir={language.direction} aria-current={language.code === locale ? "page" : undefined} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] text-site-fg-2 transition-colors hover:bg-white/5 hover:text-site-fg aria-[current=page]:bg-white/10 aria-[current=page]:text-site-fg" onClick={(event) => { remember(language.code); event.currentTarget.href = target(language.code) + window.location.search + window.location.hash; }}>
        <span>{language.label}</span>{language.code === locale && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
      </a>)}</div>
    </nav>
  </div>;
}
