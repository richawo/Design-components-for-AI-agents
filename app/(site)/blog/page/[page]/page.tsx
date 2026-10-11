import BlogIndex from "@/components/site/blog-index";
import { hubMetadata, hubInfo, hubPath, PAGE_SIZE } from "@/lib/blog/seo";
import { allPosts } from "@/lib/content";
import { blogConfig } from "@/lib/blog/runtime";
import { permanentRedirect } from "next/navigation";
type Props = { params: Promise<{ page: string }> };
export function generateStaticParams() {
  const locale = "en";
  return Array.from({ length: Math.max(0, Math.ceil(allPosts(locale).length / PAGE_SIZE) - 1) }, (_, i) => ({ page: String(i + 2) }));
}
export async function generateMetadata({ params }: Props) { const p = await params; return hubMetadata({ locale: "en", page: /^\d+$/.test(p.page) ? Number(p.page) : NaN }); }
export default async function Page({ params }: Props) {
  const p = await params;
  if (p.page === "1") permanentRedirect(hubPath({ locale: "en" }));
  return <BlogIndex {...{ locale: "en", page: /^\d+$/.test(p.page) ? Number(p.page) : NaN }} />;
}
