import { CORS, mcpGet, mcpPost } from "@/lib/mcp-http";

/**
 * Signed-in MCP endpoint. Clients that receive its 401 discover
 * /.well-known/oauth-protected-resource/mcp/pro and open a browser sign-in:
 *
 *   claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp/pro
 *
 * A licence key in the Authorization header is accepted too.
 */

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET(req: Request) {
  return mcpGet(req, "signed-in");
}

export function POST(req: Request) {
  return mcpPost(req, "signed-in");
}
