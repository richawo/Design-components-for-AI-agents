import { notFound } from "next/navigation";
import { RootDocument, rootMetadata, rootViewport } from "@/components/site/root-document";
import { localeByCode } from "@/lib/blog/locales.mjs";
import "@/app/preview/preview.css";

export const metadata = rootMetadata;
export const viewport = rootViewport;
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "en" || !localeByCode(locale)) notFound();
  return <RootDocument locale={locale}>{children}</RootDocument>;
}
