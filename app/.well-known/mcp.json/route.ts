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
      signedIn: {
        description: "Same tools; the client signs in through the browser (OAuth 2.1 with PKCE and dynamic client registration). Pro unlocks when the account holds a licence.",
        transport: { type: "streamable-http", url: absoluteUrl("/mcp/pro") },
        authentication: { type: "oauth2", required: true, protectedResourceMetadata: absoluteUrl("/.well-known/oauth-protected-resource/mcp/pro"), authorizationServerMetadata: absoluteUrl("/.well-known/oauth-authorization-server") },
      },
      tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description })),
      install: {
        claudeCode: `claude mcp add --transport http design-for-ai ${absoluteUrl("/mcp/pro")}`,
        codex: `codex mcp add design-for-ai --url ${absoluteUrl("/mcp/pro")} && codex mcp login design-for-ai`,
        mcpJson: { mcpServers: { "design-for-ai": { url: absoluteUrl("/mcp/pro") } } },
        free: `claude mcp add --transport http design-for-ai ${absoluteUrl("/mcp")}`,
        stdio: "npx -y design-for-ai-mcp",
        cli: "npx design-for-ai",
      },
      docs: absoluteUrl("/docs/agents.md"),
      llms: absoluteUrl("/llms.txt"),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
