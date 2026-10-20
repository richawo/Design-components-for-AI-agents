"use client";

import { useSiteI18n } from "./site-i18n";
import { SiteLink as Link } from "./site-link";

export function LocalizedNotFound() {
  const { localize } = useSiteI18n();
  return localize(<div className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
    <p className="font-mono text-xs uppercase tracking-[0.16em] text-site-fg-3">404 / Page not found</p>
    <h1 className="mt-6 max-w-[18ch] text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-none tracking-[-0.05em]">This page could not be found.</h1>
    <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-site-fg-2">The link may be out of date, or the address may have a typo. The library is a good place to start again.</p>
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/components" className="site-btn site-btn-primary min-h-12 px-6 text-sm">Browse components</Link><Link href="/docs" className="site-btn site-btn-secondary min-h-12 px-6 text-sm">Read the docs</Link></div>
  </div>);
}
