"use client";

import { createContext, useContext, useMemo, useState, useLayoutEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { treeLocalizer } from "@/lib/i18n/tree";
import type { Dictionary } from "@/lib/i18n/translate";
import { I18nContext as Context } from "@/lib/i18n/context";

type LanguageLinks = { path: string; links: Record<string, string> };
const LanguageContext = createContext<{ current: LanguageLinks; set: (links: LanguageLinks) => void }>({ current: { path: "", links: {} }, set: () => {} });

export function SiteI18n({ locale, dictionary, children, inherit = false }: { locale: string; dictionary: Dictionary; children: ReactNode; inherit?: boolean }) {
  const parent = useContext(Context);
  const value = useMemo(() => treeLocalizer(locale, inherit && parent.locale === locale ? { ...parent.dictionary, ...dictionary } : dictionary), [locale, dictionary, inherit, parent]);
  const [current, set] = useState<LanguageLinks>({ path: "", links: {} });
  const languageLinks = useMemo(() => ({ current, set }), [current]);
  return <Context.Provider value={value}><LanguageContext.Provider value={languageLinks}>{children}</LanguageContext.Provider></Context.Provider>;
}

export const useSiteI18n = () => useContext(Context);
export function SiteText({ children }: { children: ReactNode }) { return useSiteI18n().localize(children); }
export const useLanguageLinks = () => useContext(LanguageContext).current;

/** Blog slugs differ by edition; the article supplies its verified equivalents. */
export function SiteLanguageLinks({ links }: { links: Record<string, string> }) {
  const path = usePathname();
  const { set } = useContext(LanguageContext);
  useLayoutEffect(() => { set({ path, links }); }, [path, links, set]);
  return null;
}
