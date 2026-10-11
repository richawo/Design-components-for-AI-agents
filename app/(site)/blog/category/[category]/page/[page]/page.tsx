import BlogIndex from "@/components/site/blog-index";
import { hubMetadata, hubInfo, hubPath, PAGE_SIZE } from "@/lib/blog/seo";
import { allPosts } from "@/lib/content";
import { blogConfig } from "@/lib/blog/runtime";
import { permanentRedirect } from "next/navigation";
type Props = { params: Promise<{ category: string; page: string }> };
export function generateStaticParams() {
  const locale = "en";
  return Object.keys(blogConfig(locale)?.categories ?? {}).flatMap((category) => {
    const pages = Math.ceil(allPosts(locale).filter((post) => post.categoryKey === category).length / PAGE_SIZE);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ category, page: String(i + 2) }));
  });
}
export async function generateMetadata({ params }: Props) { const p = await params; return hubMetadata({ locale: "en", category: p.category, page: /^\d+$/.test(p.page) ? Number(p.page) : NaN }); }
export default async function Page({ params }: Props) {
  const p = await params;
  if (p.page === "1") permanentRedirect(hubPath({ locale: "en", category: p.category }));
  return <BlogIndex {...{ locale: "en", category: p.category, page: /^\d+$/.test(p.page) ? Number(p.page) : NaN }} />;
}
