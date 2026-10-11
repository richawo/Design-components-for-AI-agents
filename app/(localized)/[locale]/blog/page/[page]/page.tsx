import BlogIndex from "@/components/site/blog-index";
import { hubMetadata, hubInfo, hubPath, PAGE_SIZE } from "@/lib/blog/seo";
import { allPosts } from "@/lib/content";
import { blogConfig } from "@/lib/blog/runtime";
import { permanentRedirect } from "next/navigation";
type Props = { params: Promise<{ locale: string; page: string }> };
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const locale = params.locale;
  return Array.from({ length: Math.max(0, Math.ceil(allPosts(locale).length / PAGE_SIZE) - 1) }, (_, i) => ({ page: String(i + 2) }));
}
export async function generateMetadata({ params }: Props) { const p = await params; return hubMetadata({ locale: p.locale, page: /^\d+$/.test(p.page) ? Number(p.page) : NaN }); }
export default async function Page({ params }: Props) {
  const p = await params;
  if (p.page === "1") permanentRedirect(hubPath({ locale: p.locale }));
  return <BlogIndex {...{ locale: p.locale, page: /^\d+$/.test(p.page) ? Number(p.page) : NaN }} />;
}
