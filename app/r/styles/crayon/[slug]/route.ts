import { requireCommerceLicense } from "@/lib/commerce/licences";
import { unauthorized } from "@/lib/license";
import { getComponent } from "@/lib/registry";
import { readVisualSource, styleRegistryItem } from "@/lib/visual-style-source";
import { parseStyleTheme, supportsVisualStyle } from "@/lib/visual-styles";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const raw = (await params).slug;
  if (!/^[a-z0-9-]+\.json$/.test(raw)) return Response.json({ error: "Not found" }, { status: 404 });
  const slug = raw.slice(0,-5), entry = getComponent(slug);
  if (!entry || !supportsVisualStyle(entry, "crayon")) return Response.json({ error: "Not found" }, { status: 404 });
  const theme = parseStyleTheme(new URL(req.url).searchParams.get("theme"));
  if (!theme) return Response.json({error:"Theme not available"},{status:400,headers:{"Cache-Control":"private, no-store"}});
  const access = await requireCommerceLicense(req);
  if (!access.ok) return unauthorized(access.reason);
  const source = await readVisualSource(slug,"crayon",theme);
  if (!source) return Response.json({ error: "Style not available in this build" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return Response.json(styleRegistryItem(entry,source), { headers: { "Cache-Control": "private, no-store" } });
}
