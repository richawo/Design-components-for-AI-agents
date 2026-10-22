import "server-only";
import { commerceEnv } from "@/lib/commerce/env";
import { requireCommerceLicense } from "@/lib/commerce/licences";
import { ACCESS_PREFIX, accessTokenUser, accountLicence, oauthOrigin } from "@/lib/commerce/oauth";
import { handleMessage, type Ctx, type KeyIssue } from "@/lib/mcp";

/**
 * Streamable HTTP (stateless, JSON responses) for both MCP endpoints:
 *
 *   /mcp      Open. Free components anonymously; a licence key header or an
 *             OAuth access token unlocks Pro. A rejected key is explained to
 *             the agent instead of silently serving the free tier.
 *   /mcp/pro  Requires a credential. Without one it answers 401 with
 *             protected-resource metadata, so MCP clients (Claude, ChatGPT,
 *             Cursor, VS Code, Codex) open a browser sign-in on this site.
 */

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
};

type Mode = "open" | "signed-in";
type Auth = { ctx: Ctx } | { challenge: Response };

function challenge(req: Request, error?: { code: string; description: string }) {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const parts = [
    ...(error ? [`error="${error.code}"`, `error_description="${error.description}"`] : []),
    `resource_metadata="${oauthOrigin()}/.well-known/oauth-protected-resource${path}"`,
    'scope="mcp"',
  ];
  return new Response(JSON.stringify({ error: error?.code ?? "unauthorized", error_description: error?.description ?? "Sign in to Design for AI to use this MCP server." }), {
    status: 401,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store", "WWW-Authenticate": `Bearer ${parts.join(", ")}` },
  });
}

/** Spots the common setup mistakes that otherwise look like a working free connection. */
export function keyIssue(header: string | null, reason?: string): KeyIssue | undefined {
  if (header === null) return undefined;
  const value = header.replace(/^bearer\b\s*/i, "").trim();
  if (!/^bearer\b/i.test(header.trim())) return "scheme";
  if (!value) return "empty";
  if (/^\$|\$\{|\{\{/.test(value)) return "unexpanded";
  if (reason === "expired") return "expired";
  if (reason === "revoked") return "revoked";
  return "invalid";
}

async function authenticate(req: Request, mode: Mode): Promise<Auth> {
  const header = req.headers.get("authorization");
  const bearer = header?.match(/^bearer\s+(\S+)\s*$/i)?.[1];
  if (bearer?.startsWith(ACCESS_PREFIX)) {
    const env = await commerceEnv();
    const user = await accessTokenUser(env, bearer);
    // Expired tokens must fail with 401 on either endpoint so the client refreshes them.
    if (!user) return { challenge: challenge(req, { code: "invalid_token", description: "The access token is invalid or expired." }) };
    return { ctx: { license: await accountLicence(env, user), account: { email: user.email } } };
  }
  if (mode === "signed-in" && !bearer) return { challenge: challenge(req) };
  // Session cookies are ignored here: this endpoint is cross-origin and bearer-only.
  const license = bearer ? await requireCommerceLicense(req) : { ok: false as const, reason: "missing" as const };
  if (license.ok) return { ctx: { license } };
  if (mode === "signed-in") return { challenge: challenge(req, { code: "invalid_token", description: `The licence key was rejected (${license.reason}).` }) };
  return { ctx: { license, keyIssue: keyIssue(header, license.reason) } };
}

export async function mcpGet(req: Request, mode: Mode) {
  if (mode === "signed-in") {
    const auth = await authenticate(req, mode);
    if ("challenge" in auth) return auth.challenge;
  }
  return new Response("This MCP server speaks Streamable HTTP over POST. See https://design.yaps.ai/docs/agents", {
    status: 405,
    headers: { ...CORS, Allow: "POST, OPTIONS", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function mcpPost(req: Request, mode: Mode) {
  const auth = await authenticate(req, mode);
  if ("challenge" in auth) return auth.challenge;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as Parameters<typeof handleMessage>[0][];
  const replies = (await Promise.all(messages.map((m) => handleMessage(m, auth.ctx)))).filter((r) => r !== null);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? replies : replies[0], { headers: { ...CORS, "Cache-Control": "no-store" } });
}
