import { sitemapIndex } from "@/lib/blog/feeds";
export const dynamic = "force-static";
export function GET() { return new Response(sitemapIndex(), { headers: { "Content-Type": "application/xml; charset=utf-8" } }); }
