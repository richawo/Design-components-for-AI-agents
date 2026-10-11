import { highlight } from "@/lib/highlight";
import { allComponents, getComponent, readSource } from "@/lib/registry";

// Free source is a separate, prebuilt payload. Navigation carries the preview
// and page content; it no longer parses thousands of hidden syntax tokens.
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return allComponents().filter(c => c.tier === "free").map(c => ({ slug: c.slug }));
}
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (getComponent(slug)?.tier !== "free") return Response.json({ error: "Not found" }, { status: 404 });
  const source = await readSource(slug);
  if (!source) return Response.json({ error: "Not found" }, { status: 404 });
  const [codeHtml, promptJsonHtml] = await Promise.all([highlight(source.code, "tsx"), highlight(source.promptJson, "json")]);
  return Response.json({ ...source, codeHtml, promptJsonHtml }, { headers: { "Cache-Control": "public, max-age=0, must-revalidate" } });
}
