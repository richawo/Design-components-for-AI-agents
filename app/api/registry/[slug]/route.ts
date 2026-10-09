import { fileNameFor, installText } from "@/lib/install";
import { unauthorized } from "@/lib/license";
import { requireCommerceLicense } from "@/lib/commerce/licences";
import { getComponent, readSource } from "@/lib/registry";

/**
 * Everything an agent needs for one component: metadata, install command,
 * code, prompt and JSON prompt. `?format=raw` returns just the .tsx file.
 * Pro components need `Authorization: Bearer <licence>`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComponent(slug);
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  if (entry.tier === "pro") {
    const v = await requireCommerceLicense(req);
    if (!v.ok) return unauthorized(v.reason);
  }
  const src = await readSource(slug);
  if (!src) return Response.json({ error: "Source not available in this build" }, { status: 404 });
  const cache = entry.tier === "pro" ? "private, no-store" : "public, max-age=300, s-maxage=3600";
  if (new URL(req.url).searchParams.get("format") === "raw") {
    return new Response(src.code, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": cache } });
  }
  const { hasSource: _h, ...meta } = entry;
  return Response.json(
    { ...meta, file: fileNameFor(entry), install: installText(entry), code: src.code, prompt: src.prompt, promptJson: JSON.parse(src.promptJson) },
    { headers: { "Cache-Control": cache } },
  );
}
