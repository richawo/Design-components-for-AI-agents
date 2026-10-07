import { allPosts, rawPost } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = allPosts().find((p) => p.slug === slug);
  const raw = rawPost(slug);
  if (!meta || !raw) return new Response("Not found", { status: 404 });
  const md = ["---", `title: ${JSON.stringify(meta.title)}`, `canonical: ${absoluteUrl(`/blog/${slug}`)}`, `date: ${meta.date}`, `dateModified: ${meta.dateModified}`, "---", "", `# ${meta.title}`, "", `> ${meta.description}`, "", raw.content.trim(), ""].join("\n");
  return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex, follow", Link: `<${absoluteUrl(`/blog/${slug}`)}>; rel="canonical"` } });
}
