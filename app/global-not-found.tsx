import Link from "next/link";
import { RootDocument } from "@/components/site/root-document";
import { Logo } from "@/components/site/logo";

export const metadata = { title: "Page not found | Design for AI", robots: { index: false, follow: true } };

export default function NotFound() {
  return <RootDocument><main className="mx-auto flex min-h-dvh max-w-4xl flex-col px-6 py-10 text-site-fg sm:px-8">
    <div className="w-fit"><Logo /></div>
    <div className="my-auto py-20">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-site-fg-3">404 / Page not found</p>
      <h1 className="mt-6 max-w-[14ch] text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-none tracking-[-0.05em]">This page could not be found.</h1>
      <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-site-fg-2">The link may be out of date, or the address may have a typo. The library is a good place to start again.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/components" className="site-btn site-btn-primary min-h-12 px-6 text-sm">Browse components</Link><Link href="/docs" className="site-btn site-btn-secondary min-h-12 px-6 text-sm">Read the docs</Link></div>
    </div>
  </main></RootDocument>;
}
