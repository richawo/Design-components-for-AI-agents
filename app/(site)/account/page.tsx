import { SiteI18n } from "@/components/site/site-i18n";
import { siteAlternates } from "@/lib/i18n/metadata";
import { serverI18n, siteCopy } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountLoading } from "@/components/site/account-panel";
import { AccountRoutePanel } from "@/components/site/account-route-panel";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false }, alternates: { canonical: "/account", languages: siteAlternates("/account") } };

export default async function AccountPage({ params }: { params: Promise<{ locale?: string }> }) {

  const { locale = "en" } = await params;
  const { localize } = await serverI18n(locale);
  return (
    localize(<SiteI18n inherit locale={locale} dictionary={await siteCopy(locale, "account")}><div className="mx-auto max-w-5xl px-5 pb-28 pt-14 sm:px-8 lg:pt-20">
      <p className="site-in font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">Account</p>
      <h1 className="site-in mt-4 text-[clamp(2.5rem,1.6rem+3.4vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.05em] [--i:1]">
        <span className="site-silver-text">Your</span> <span className="text-site-fg-3">licence.</span>
      </h1>
      <div className="mt-10">
        <Suspense fallback={<AccountLoading />}><AccountRoutePanel /></Suspense>
      </div>
    </div></SiteI18n>)
  );
}
