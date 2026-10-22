import { commerceEnv } from "@/lib/commerce/env";
import { revokeToken } from "@/lib/commerce/oauth";
import { OAUTH_CORS, oauthFailure, readForm } from "@/lib/commerce/oauth-http";

export async function POST(req: Request) {
  try {
    await revokeToken(await commerceEnv(), await readForm(req), req.headers.get("authorization"));
    return new Response(null, { status: 200, headers: { ...OAUTH_CORS, "Cache-Control": "no-store" } });
  } catch (error) { return oauthFailure(error); }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}
