import { highlight } from "@/lib/highlight";
import { requireLicense, unauthorized } from "@/lib/license";
import { getComponent, readSource } from "@/lib/registry";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComponent(slug);
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  if (entry.tier === "pro") {
    const v = requireLicense(req);
    if (!v.ok) return unauthorized(v.reason);
  }
  const src = readSource(slug);
  if (!src) return Response.json({ error: "Source not available in this build" }, { status: 404 });
  return Response.json(
    {
      code: src.code,
      codeHtml: await highlight(src.code, "tsx"),
      prompt: src.prompt,
      promptJson: src.promptJson,
      promptJsonHtml: await highlight(src.promptJson, "json"),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
