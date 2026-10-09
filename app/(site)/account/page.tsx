import type { Metadata } from "next";
import { AccountPanel } from "@/components/site/account-panel";

export const metadata: Metadata = { title: "Your licence", robots: { index: false, follow: false }, alternates: { canonical: "/account" } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-14 sm:px-8 lg:pt-20">
      <p className="site-in font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">Account</p>
      <h1 className="site-in mt-4 text-[clamp(2.5rem,1.6rem+3.4vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.05em] [--i:1]">
        <span className="site-silver-text">Your</span> <span className="text-site-fg-3">licence.</span>
      </h1>
      <div className="mt-10">
        <AccountPanel welcome={welcome === "1"} />
      </div>
    </div>
  );
}
