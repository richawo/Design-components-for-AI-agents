import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allComponents, getComponent, readSource } from "@/lib/registry";
import { previewAccent } from "@/lib/preview-accent";
import { PreviewRenderer } from "@/components/site/preview-renderer";

export const dynamicParams = false;

export function generateStaticParams() {
  return allComponents().filter((c) => c.hasSource).map((c) => ({ slug: c.slug }));
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComponent(slug);
  if (!entry || !entry.hasSource) notFound();
  const source = await readSource(slug);
  const accentConfig = previewAccent(source?.code ?? "", entry.controls ?? [], entry.props);
  return <PreviewRenderer accentConfig={accentConfig} slug={slug} platform={entry.platform} theme={entry.theme} demo={entry.demo} />;
}
