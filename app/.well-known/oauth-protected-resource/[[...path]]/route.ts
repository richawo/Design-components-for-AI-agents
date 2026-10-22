import { MCP_RESOURCE_PATHS, oauthOrigin, protectedResourceMetadata } from "@/lib/commerce/oauth";

const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" };

/** RFC 9728 metadata for /mcp/pro (and /mcp), found from the 401 challenge or by path insertion. */
export async function GET(_req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const resource = path.length ? `/${path.join("/")}` : "/mcp/pro";
  if (!MCP_RESOURCE_PATHS.includes(resource)) return Response.json({ error: "not_found" }, { status: 404, headers });
  return Response.json(protectedResourceMetadata(oauthOrigin(), resource), { headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Headers": "Mcp-Protocol-Version" } });
}
