import { requireCommerceLicense } from "@/lib/commerce/licences";
import { getComponent } from "@/lib/registry";
import { readVisualSource, type StyledSource } from "@/lib/visual-style-source";
import { supportsVisualStyle } from "@/lib/visual-styles";

/** The preview receives only the selected component's material, after a live licence check. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComponent(slug);
  const headers = { "Cache-Control": "private, no-store" };
  if (!entry || !supportsVisualStyle(entry, "crayon")) return Response.json({ error: "Style not available" }, { status: 404, headers });
  const access = await requireCommerceLicense(req);
  if (!access.ok) return Response.json({ locked: true, reason: access.reason }, { headers });
  const source = await readVisualSource(slug, "crayon") as StyledSource | null;
  if (!source) return Response.json({ error: "Style not available in this build" }, { status: 404, headers });
  return Response.json({ visualStyle: "crayon", css: source.styleCss, font: source.font, palette: JSON.parse(source.promptJson).visualStyle?.palette ?? {}, themes: JSON.parse(source.promptJson).visualStyle?.themes }, { headers });
}
