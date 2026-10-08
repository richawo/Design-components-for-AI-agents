import { requireLicense, unauthorized } from "@/lib/license";
import { readProItem } from "@/lib/registry";

/** shadcn registry items for Pro components: `npx shadcn add @design-for-ai-pro/<slug>`. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = slug.replace(/\.json$/, "");
  if (!/^[a-z0-9-]+$/.test(name)) return Response.json({ error: "Not found" }, { status: 404 });
  const v = requireLicense(req);
  if (!v.ok) return unauthorized(v.reason);
  const item = await readProItem(name);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(item, { headers: { "Cache-Control": "private, no-store" } });
}
