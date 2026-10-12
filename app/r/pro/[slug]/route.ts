import { unauthorized } from "@/lib/license";
import { requireCommerceLicense } from "@/lib/commerce/licences";
import { getComponent, readProItem } from "@/lib/registry";

/** shadcn registry items for Pro components: `npx shadcn add @design-for-ai-pro/<slug>`. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = slug.replace(/\.json$/, "");
  if (!/^[a-z0-9-]+$/.test(name)) return Response.json({ error: "Not found" }, { status: 404 });
  // Keep existing installs working when a component joins the free catalogue.
  if (getComponent(name)?.tier === "free") {
    return new Response(null, {
      status: 302,
      headers: { Location: new URL(`/r/${name}.json`, req.url).href, "Cache-Control": "public, max-age=300" },
    });
  }
  const v = await requireCommerceLicense(req);
  if (!v.ok) return unauthorized(v.reason);
  const item = await readProItem(name);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(item, { headers: { "Cache-Control": "private, no-store" } });
}
