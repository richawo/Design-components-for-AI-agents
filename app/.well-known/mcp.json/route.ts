import { INSTRUCTIONS, SERVER_INFO, TOOLS } from "@/lib/mcp";
import { absoluteUrl, site } from "@/lib/site";

export const dynamic = "force-static";

/** Discovery document so agents and tools can find the MCP endpoint from the domain alone. */
export function GET() {
  return Response.json(
    {
      ...SERVER_INFO,
      description: site.description,
      websiteUrl: site.url,
      instructions: INSTRUCTIONS,
      transport: { type: "streamable-http", url: absoluteUrl("/mcp") },
      authentication: { type: "bearer", required: false, description: "A Design for AI licence key unlocks Pro components.", obtain: absoluteUrl("/pricing") },
      tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description })),
      install: {
        claudeCode: `claude mcp add --transport http design-for-ai ${absoluteUrl("/mcp")}`,
        mcpJson: { mcpServers: { "design-for-ai": { url: absoluteUrl("/mcp") } } },
        stdio: "npx -y design-for-ai-mcp",
        cli: "npx design-for-ai",
      },
      docs: absoluteUrl("/docs/agents.md"),
      llms: absoluteUrl("/llms.txt"),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
