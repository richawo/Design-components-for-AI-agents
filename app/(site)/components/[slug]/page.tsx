import { notFound, permanentRedirect } from "next/navigation";
import {
  ComponentDetail,
  componentMetadata,
} from "@/components/site/component-detail";
import { cataloguePath } from "@/lib/catalogue-path";
import { getComponent, individualComponents } from "@/lib/registry";
import { localizePath } from "@/lib/i18n/routing";

export const dynamicParams = false;
export function generateStaticParams() {
  return individualComponents().map((entry) => ({ slug: entry.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale?: string }>;
}) {
  const entry = getComponent((await params).slug);
  return entry ? componentMetadata(entry) : {};
}
export default async function ComponentPage({
  params,
}: {
  params: Promise<{ slug: string; locale?: string }>;
}) {
  const { slug, locale = "en" } = await params;
  const entry = getComponent(slug);
  if (!entry) notFound();
  if (entry.kind === "block") permanentRedirect(localizePath(cataloguePath(entry), locale));
  return <ComponentDetail entry={entry} locale={locale} />;
}
