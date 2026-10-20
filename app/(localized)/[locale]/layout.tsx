import { notFound } from "next/navigation";
import { RootDocument, rootMetadata, rootViewport } from "@/components/site/root-document";
import { SiteShell } from "@/components/site/site-shell";
import { LOCALES, localeByCode } from "@/lib/blog/locales.mjs";
export const metadata = rootMetadata;
export const viewport = rootViewport;
// Canonical editions are prerendered; aliases redirect at request time and
// unsupported languages are rejected by the layout instead of falling back.
export const dynamicParams = true;
export const generateStaticParams = () => LOCALES.filter((l) => l.code !== "en").map((l) => ({ locale: l.code }));
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "en" || !localeByCode(locale)) notFound();
  return <RootDocument locale={locale}><SiteShell locale={locale}>{children}</SiteShell></RootDocument>;
}
