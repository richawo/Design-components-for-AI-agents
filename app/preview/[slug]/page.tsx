import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { allComponents, getComponent, readSource } from "@/lib/registry";
import { previewAccent } from "@/lib/preview-accent";
import { PreviewRenderer } from "@/components/site/preview-renderer";
import { PreviewI18n } from "@/components/site/preview-i18n";
import { previewDictionaryUrl, serverI18n } from "@/lib/i18n/server";
import { previewFormatLocale } from "@/lib/i18n/preview";

export const dynamicParams = false;

export function generateStaticParams() {
  return allComponents().filter((c) => c.hasSource).map((c) => ({ slug: c.slug }));
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ slug: string; locale?: string }> }) {
  const { slug, locale = "en" } = await params;
  const entry = getComponent(slug);
  if (!entry || !entry.hasSource) notFound();
  const source = await readSource(slug);
  const accentConfig = previewAccent(source?.code ?? "", entry.controls ?? [], entry.props);
  const { t } = await serverI18n(locale);
  return <PreviewI18n key={`${locale}/${slug}`} locale={locale} slug={slug} url={await previewDictionaryUrl(locale, slug)} loadingLabel={t("Loading preview")} retryLabel={t("Retry preview")}><PreviewRenderer accentConfig={accentConfig} slug={slug} platform={entry.platform} theme={entry.theme} demo={entry.demo} initialLocale={previewFormatLocale(entry.controls ?? [], locale)} /></PreviewI18n>;
}
