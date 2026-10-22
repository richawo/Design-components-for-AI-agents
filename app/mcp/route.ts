import { CORS, mcpGet, mcpPost } from "@/lib/mcp-http";

/**
 * Open remote MCP endpoint (Streamable HTTP, stateless, JSON responses).
 *
 *   claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp
 *
 * Free components need nothing. For Pro, connect to /mcp/pro and sign in, or
 * add --header "Authorization: Bearer $DESIGN_FOR_AI_LICENSE".
 */

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** No server-initiated stream: this server only answers requests. */
export function GET(req: Request) {
  return mcpGet(req, "open");
}

export function POST(req: Request) {
  return mcpPost(req, "open");
}
