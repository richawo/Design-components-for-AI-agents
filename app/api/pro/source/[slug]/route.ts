import { highlight } from "@/lib/highlight";
import { requireCommerceLicense } from "@/lib/commerce/licences";
import { getComponent, readSource } from "@/lib/registry";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComponent(slug);
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  if (entry.tier === "pro") {
    const v = await requireCommerceLicense(req);
    // The site's own source panel calls this on every Pro page. A signed-out
    // visitor is the normal case, so answer 200 with a locked flag rather
    // than an error status that shows up red in every browser console.
    if (!v.ok) return Response.json({ locked: true, reason: v.reason }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const src = await readSource(slug);
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
