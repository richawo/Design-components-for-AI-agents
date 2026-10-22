import { commerceEnv } from "@/lib/commerce/env";
import { OAuthError, registerClient } from "@/lib/commerce/oauth";
import { OAUTH_CORS, oauthFailure, oauthJson } from "@/lib/commerce/oauth-http";

/** RFC 7591 dynamic client registration, used by MCP clients the first time they connect. */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { throw new OAuthError("invalid_client_metadata", "Send client metadata as JSON."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new OAuthError("invalid_client_metadata", "Send client metadata as a JSON object.");
    return oauthJson(await registerClient(await commerceEnv(), body as Record<string, unknown>, req.headers.get("cf-connecting-ip") ?? "unknown"), 201);
  } catch (error) { return oauthFailure(error); }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}
