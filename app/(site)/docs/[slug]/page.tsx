import { siteAlternates } from "@/lib/i18n/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentConnect } from "@/components/site/agent-connect";
import { DocArticle } from "@/components/site/doc-article";
import { SiteI18n } from "@/components/site/site-i18n";
import { siteCopy } from "@/lib/i18n/server";
import { allDocs, localizedDocs, getDoc } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return allDocs()
    .filter((d) => d.slug !== "introduction")
    .map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = allDocs().find((x) => x.slug === slug);
  if (!d) return {};
  return { title: d.title, description: d.description, alternates: { canonical: `/docs/${slug}`, languages: siteAlternates(`/docs/${slug}`) } };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string; locale?: string }> }) {
  const { slug, locale = "en" } = await params;
  const doc = await getDoc(slug, locale);
  if (!doc) notFound();
  const docs = await localizedDocs(locale);
  const i = docs.findIndex((d) => d.slug === slug);
  // The agents guide opens with the interactive setup; the Markdown below remains the full reference.
  const lead = slug === "agents" ? <SiteI18n inherit locale={locale} dictionary={await siteCopy(locale, "connect")}><AgentConnect /></SiteI18n> : undefined;
  return <DocArticle locale={locale} meta={doc.meta} html={doc.html} headings={doc.headings} prev={docs[i - 1]} next={docs[i + 1]} lead={lead} />;
}
