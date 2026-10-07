import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/site/doc-article";
import { allDocs, getDoc } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const d = allDocs().find((x) => x.slug === "introduction");
  return { title: d ? `Docs: ${d.title}` : "Docs", description: d?.description, alternates: { canonical: "/docs" } };
}

export default async function DocsIndex() {
  const doc = await getDoc("introduction");
  if (!doc) notFound();
  const docs = allDocs();
  const i = docs.findIndex((d) => d.slug === "introduction");
  return <DocArticle meta={doc.meta} html={doc.html} headings={doc.headings} prev={docs[i - 1]} next={docs[i + 1]} />;
}
