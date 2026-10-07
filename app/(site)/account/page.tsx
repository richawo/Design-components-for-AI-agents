import type { Metadata } from "next";
import { AccountPanel } from "@/components/site/account-panel";

export const metadata: Metadata = { title: "Your licence", robots: { index: false, follow: false }, alternates: { canonical: "/account" } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-14 sm:px-6 lg:pt-20">
      <h1 className="text-[clamp(2.5rem,1.6rem+3.4vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
        Your <span className="site-gradient-text">licence</span>
      </h1>
      <div className="mt-10">
        <AccountPanel welcome={welcome === "1"} />
      </div>
    </div>
  );
}
