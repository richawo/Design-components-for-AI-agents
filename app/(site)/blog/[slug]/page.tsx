import BlogPost from "@/components/site/blog-post";
import { allPosts } from "@/lib/content";
import { articleMetadata } from "@/lib/blog/seo";
export const generateStaticParams = () => allPosts().map((p) => ({ slug: p.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return articleMetadata((await params).slug); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <BlogPost slug={(await params).slug} />; }
