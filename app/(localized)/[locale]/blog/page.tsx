import BlogIndex from "@/components/site/blog-index";
import { hubMetadata, hubInfo, hubPath, PAGE_SIZE } from "@/lib/blog/seo";
import { allPosts } from "@/lib/content";
import { blogConfig } from "@/lib/blog/runtime";
import { permanentRedirect } from "next/navigation";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) { const p = await params; return hubMetadata({ locale: p.locale }); }
export default async function Page({ params }: Props) {
  const p = await params;
  return <BlogIndex {...{ locale: p.locale }} />;
}
