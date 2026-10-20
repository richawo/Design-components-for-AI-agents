import { siteAlternates } from "@/lib/i18n/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/site/doc-article";
import { allDocs, localizedDocs, getDoc } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const d = allDocs().find((x) => x.slug === "introduction");
  return { title: d ? `Docs: ${d.title}` : "Docs", description: d?.description, alternates: { canonical: "/docs", languages: siteAlternates("/docs") } };
}

export default async function DocsIndex({ params }: { params: Promise<{ locale?: string }> }) {
  const { locale = "en" } = await params;
  const doc = await getDoc("introduction", locale);
  if (!doc) notFound();
  const docs = await localizedDocs(locale);
  const i = docs.findIndex((d) => d.slug === "introduction");
  return <DocArticle locale={locale} meta={doc.meta} html={doc.html} headings={doc.headings} prev={docs[i - 1]} next={docs[i + 1]} />;
}
