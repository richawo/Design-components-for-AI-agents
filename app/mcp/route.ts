import { requireCommerceLicense } from "@/lib/commerce/licences";
import { handleMessage } from "@/lib/mcp";

/**
 * Remote MCP endpoint (Streamable HTTP, stateless, JSON responses).
 *
 *   claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp
 *
 * Pro: add --header "Authorization: Bearer $DESIGN_FOR_AI_LICENSE".
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** No server-initiated stream: this server only answers requests. */
export function GET() {
  return new Response("This MCP server speaks Streamable HTTP over POST. See https://design.yaps.ai/docs/agents", {
    status: 405,
    headers: { ...CORS, Allow: "POST, OPTIONS", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  }
  // A missing or malformed key just means free components, never an error.
  const license = await requireCommerceLicense(req);
  const ctx = { license };
  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as Parameters<typeof handleMessage>[0][];
  const replies = (await Promise.all(messages.map((m) => handleMessage(m, ctx)))).filter((r) => r !== null);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? replies : replies[0], { headers: { ...CORS, "Cache-Control": "no-store" } });
}
