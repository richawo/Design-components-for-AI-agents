import { fileNameFor, installText } from "@/lib/install";
import { unauthorized } from "@/lib/license";
import { requireCommerceLicense } from "@/lib/commerce/licences";
import { getComponent } from "@/lib/registry";
import { readVisualSource } from "@/lib/visual-style-source";
import { parseVisualStyle, supportsVisualStyle, styleInstallText } from "@/lib/visual-styles";

/**
 * Everything an agent needs for one component: metadata, install command,
 * code, prompt and JSON prompt. `?format=raw` returns just the .tsx file.
 * Pro components need `Authorization: Bearer <licence>`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComponent(slug);
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  const visualStyle = parseVisualStyle(new URL(req.url).searchParams.get("visualStyle"));
  if (!visualStyle || !supportsVisualStyle(entry, visualStyle)) return Response.json({ error: "Style not available" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const paid = entry.tier === "pro" || visualStyle !== "original";
  if (paid) {
    const v = await requireCommerceLicense(req);
    if (!v.ok) return unauthorized(v.reason);
  }
  const cache = paid ? "private, no-store" : "public, max-age=300, s-maxage=3600";
  const src = await readVisualSource(slug, visualStyle);
  if (!src) return Response.json({ error: "Source not available in this build" }, { status: 404, headers: { "Cache-Control": cache } });
  if (new URL(req.url).searchParams.get("format") === "raw") {
    return new Response(src.code, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": cache } });
  }
  const { hasSource: _h, ...meta } = entry;
  return Response.json(
    { ...meta, file: fileNameFor(entry), visualStyle, styleTier: visualStyle === "original" ? entry.tier : "pro", install: visualStyle === "original" ? installText(entry) : styleInstallText(entry), code: src.code, prompt: src.prompt, promptJson: JSON.parse(src.promptJson) },
    { headers: { "Cache-Control": cache } },
  );
}
