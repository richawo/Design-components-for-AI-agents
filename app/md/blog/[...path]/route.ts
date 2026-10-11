import { blogMarkdown } from "@/lib/blog/feeds";
import { absoluteUrl } from "@/lib/site";
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const result = blogMarkdown((await params).path);
  if (!result) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, follow" } });
  if (result.alias) return new Response(null, { status: 308, headers: { Location: `${result.path}.md` } });
  return new Response(result.body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex, follow", Link: `<${absoluteUrl(result.path)}>; rel="canonical"`, Vary: "Accept" } });
}
