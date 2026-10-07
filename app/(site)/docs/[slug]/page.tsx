import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/site/doc-article";
import { allDocs, getDoc } from "@/lib/content";

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
  return { title: d.title, description: d.description, alternates: { canonical: `/docs/${slug}` } };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();
  const docs = allDocs();
  const i = docs.findIndex((d) => d.slug === slug);
  return <DocArticle meta={doc.meta} html={doc.html} headings={doc.headings} prev={docs[i - 1]} next={docs[i + 1]} />;
}
