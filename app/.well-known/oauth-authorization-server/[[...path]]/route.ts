import { authorizationServerMetadata, oauthOrigin } from "@/lib/commerce/oauth";

const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" };

/** RFC 8414 metadata. Path-suffixed lookups from older MCP clients get the same document. */
export function GET() {
  return Response.json(authorizationServerMetadata(oauthOrigin()), { headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Headers": "Mcp-Protocol-Version" } });
}
