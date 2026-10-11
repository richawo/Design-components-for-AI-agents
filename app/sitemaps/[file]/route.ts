import { sitemapLocales, localeSitemap, markdownSitemap } from "@/lib/blog/feeds";
export const dynamic = "force-static";
export const generateStaticParams = () => sitemapLocales().flatMap((locale) => [{ file: `${locale}.xml` }, { file: `${locale}.md` }]);
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params, match = /^([a-z-]+)\.(xml|md)$/.exec(file);
  if (!match || !sitemapLocales().includes(match[1])) return new Response("Not found", { status: 404 });
  const markdown = match[2] === "md";
  return new Response(markdown ? markdownSitemap(match[1]) : localeSitemap(match[1]), { headers: { "Content-Type": `${markdown ? "text/markdown" : "application/xml"}; charset=utf-8`, ...(markdown ? { "X-Robots-Tag": "noindex, follow" } : {}) } });
}
