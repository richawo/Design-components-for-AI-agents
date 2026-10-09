import { markdownForPage, markdownPagePaths } from "@/lib/page-markdown";
import { absoluteUrl } from "@/lib/site";

/** Markdown twins of site pages. Rewritten from `/<page>.md` in next.config.ts. */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return markdownPagePaths().map((p) => ({ path: p.split("/") }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const md = await markdownForPage(path.join("/"));
  if (!md) return new Response("Not found", { status: 404 });
  const page = path.join("/") === "index" ? "/" : `/${path.join("/")}`;
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      Link: `<${absoluteUrl(page)}>; rel="canonical"`,
    },
  });
}
