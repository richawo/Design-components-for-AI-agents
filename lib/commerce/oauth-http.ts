import "server-only";
import { CommerceError } from "./env";
import { OAuthError } from "./oauth";

/** OAuth endpoints are called by MCP clients, some of them browser-based, so they allow any origin. */
export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version",
};

export const oauthJson = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { ...OAUTH_CORS, "Cache-Control": "no-store", Pragma: "no-cache" } });

export function oauthFailure(error: unknown) {
  if (error instanceof OAuthError) {
    const response = oauthJson({ error: error.code, error_description: error.message }, error.status);
    if (error.status === 401) response.headers.set("WWW-Authenticate", 'Basic realm="design-for-ai"');
    return response;
  }
  if (error instanceof CommerceError) {
    return oauthJson({ error: error.status === 429 ? "slow_down" : "temporarily_unavailable", error_description: error.message }, error.status);
  }
  // Never log request bodies: they carry codes, verifiers and tokens.
  console.error("oauth: request failed");
  return oauthJson({ error: "server_error", error_description: "Something went wrong. Please try again shortly." }, 503);
}

/** Token and revocation requests are form-encoded (RFC 6749); JSON is accepted for lenient clients. */
export async function readForm(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.length > 16_000) throw new OAuthError("invalid_request", "Request body too large.");
  if (type.includes("application/json")) {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new OAuthError("invalid_request", "Malformed JSON."); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new OAuthError("invalid_request", "Expected an object.");
    return new URLSearchParams(Object.entries(data).filter(([, value]) => typeof value === "string") as [string, string][]);
  }
  return new URLSearchParams(text);
}
