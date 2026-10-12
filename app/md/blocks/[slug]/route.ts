import { getComponent } from "@/lib/registry";
import { GET as componentMarkdown } from "../../components/[slug]/route";

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const entry = getComponent((await context.params).slug);
  if (entry?.kind !== "block")
    return new Response("Not found", { status: 404 });
  return componentMarkdown(req, context);
}
