import { notFound } from "next/navigation";
import {
  ComponentDetail,
  componentMetadata,
} from "@/components/site/component-detail";
import { allBlocks, getComponent } from "@/lib/registry";

export const dynamicParams = false;
export function generateStaticParams() {
  return allBlocks().map((entry) => ({ slug: entry.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale?: string }>;
}) {
  const entry = getComponent((await params).slug);
  return entry?.kind === "block" ? componentMetadata(entry) : {};
}
export default async function BlockPage({
  params,
}: {
  params: Promise<{ slug: string; locale?: string }>;
}) {
  const { slug, locale = "en" } = await params;
  const entry = getComponent(slug);
  if (entry?.kind !== "block") notFound();
  return <ComponentDetail entry={entry} locale={locale} />;
}
