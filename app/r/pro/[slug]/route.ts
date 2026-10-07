import fs from "node:fs";
import path from "node:path";
import { requireLicense, unauthorized } from "@/lib/license";

/** shadcn registry items for Pro components: `npx shadcn add @design-for-ai-pro/<slug>`. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = slug.replace(/\.json$/, "");
  if (!/^[a-z0-9-]+$/.test(name)) return Response.json({ error: "Not found" }, { status: 404 });
  const v = requireLicense(req);
  if (!v.ok) return unauthorized(v.reason);
  const file = path.join(process.cwd(), "registry", "__generated__", "r-pro", `${name}.json`);
  if (!fs.existsSync(file)) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(fs.readFileSync(file, "utf8"), { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
