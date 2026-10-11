import { markdownSitemap } from "@/lib/blog/feeds";
export const dynamic = "force-static";
export function GET() { return new Response(markdownSitemap(), { headers: { "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex, follow" } }); }
