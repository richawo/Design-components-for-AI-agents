import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomePage, { metadata as homeMetadata } from "@/app/(site)/page";
import ComponentsPage, { metadata as componentsMetadata } from "@/app/(site)/components/page";
import BlocksPage, { metadata as blocksMetadata } from "@/app/(site)/blocks/page";
import PricingPage, { metadata as pricingMetadata } from "@/app/(site)/pricing/page";
import AccountPage, { metadata as accountMetadata } from "@/app/(site)/account/page";
import ComponentPage, { generateMetadata as componentMetadata } from "@/app/(site)/components/[slug]/page";
import BlockPage, { generateMetadata as blockMetadata } from "@/app/(site)/blocks/[slug]/page";
import CategoryPage, { generateMetadata as categoryMetadata } from "@/app/(site)/categories/[category]/page";
import DocsLayout from "@/app/(site)/docs/layout";
import DocsIndex, { generateMetadata as docsMetadata } from "@/app/(site)/docs/page";
import DocPage, { generateMetadata as docMetadata } from "@/app/(site)/docs/[slug]/page";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { localeByCode } from "@/lib/blog/locales.mjs";

type Props = { params: Promise<{ locale: string; path?: string[] }> };
export const dynamicParams = true;
// Cache core destinations at build time. Expanding the entire catalogue across
// 30 languages exceeds the Worker's route-manifest budget; individual entries
// and categories use the same public page implementation on demand.
export function generateStaticParams() {
  const paths = [[], ["components"], ["blocks"], ["pricing"], ["docs"], ["account"]];
  return paths.map((path) => ({ path }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, path = [] } = await params;
  if (!localeByCode(locale) || locale === "en") notFound();
  const [section, slug] = path;
  const parameters = Promise.resolve({ slug, category: slug, locale }) as Promise<{ slug: string; category: string; locale: string }>;
  let metadata: Metadata = {};
  if (!section) metadata = homeMetadata;
  else if (section === "components") metadata = slug ? await componentMetadata({ params: parameters }) : componentsMetadata;
  else if (section === "blocks") metadata = slug ? await blockMetadata({ params: parameters }) : blocksMetadata;
  else if (section === "pricing") metadata = pricingMetadata;
  else if (section === "account") metadata = accountMetadata;
  else if (section === "categories" && slug) metadata = await categoryMetadata({ params: parameters });
  else if (section === "docs") metadata = slug ? await docMetadata({ params: parameters }) : await docsMetadata();
  return localizedMetadata(metadata, locale, "/" + path.join("/"));
}

export default async function LocalizedPage({ params }: Props) {
  const { locale, path = [] } = await params;
  const [section, slug] = path;
  if (path.length > 2) notFound();
  const parameters = Promise.resolve({ locale, slug, category: slug }) as Promise<{ slug: string; category: string; locale: string }>;
  if (!section) return <HomePage params={parameters} />;
  if (section === "components") return slug ? <ComponentPage params={parameters} /> : <ComponentsPage params={parameters} />;
  if (section === "blocks") return slug ? <BlockPage params={parameters} /> : <BlocksPage params={parameters} />;
  if (section === "pricing" && !slug) return <PricingPage params={parameters} />;
  if (section === "account" && !slug) return <AccountPage params={parameters} />;
  if (section === "categories" && slug) return <CategoryPage params={parameters} />;
  if (section === "docs") return <DocsLayout params={parameters}>{slug ? <DocPage params={parameters} /> : <DocsIndex params={parameters} />}</DocsLayout>;
  notFound();
}
