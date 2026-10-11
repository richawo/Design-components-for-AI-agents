import BlogPost from "@/components/site/blog-post";
import { allPosts } from "@/lib/content";
import { articleMetadata } from "@/lib/blog/seo";
type Props = { params: Promise<{ locale: string; slug: string }> };
export const generateStaticParams = ({ params }: { params: { locale: string } }) => allPosts(params.locale).map((post) => ({ slug: post.slug }));
export async function generateMetadata({ params }: Props) { const { locale, slug } = await params; return articleMetadata(slug, locale); }
export default async function Page({ params }: Props) { const { locale, slug } = await params; return <BlogPost locale={locale} slug={slug} />; }
