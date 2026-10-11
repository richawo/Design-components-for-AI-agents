import { rss } from "@/lib/blog/feeds";
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const body = rss((await params).locale);
  return new Response(body ?? "Not found", { status: body ? 200 : 404, headers: { "Content-Type": "application/rss+xml; charset=utf-8", "X-Robots-Tag": "noindex, follow" } });
}
