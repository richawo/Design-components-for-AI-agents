import { allComponents } from "@/lib/registry";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/** Public metadata for every component. Read by the MCP server and other agents. */
export function GET() {
  return Response.json({
    name: "Design for AI",
    docs: absoluteUrl("/llms.txt"),
    // Controls stay (agents use them to configure); the demo script is only for the site.
    components: allComponents().map(({ hasSource: _h, usage: _u, props: _p, demo: _d, ...e }) => ({
      ...e,
      url: absoluteUrl(`/components/${e.slug}`),
      source: absoluteUrl(`/api/registry/${e.slug}`),
    })),
  });
}
