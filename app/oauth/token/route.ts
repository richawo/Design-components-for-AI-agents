import { commerceEnv } from "@/lib/commerce/env";
import { exchangeToken, oauthOrigin } from "@/lib/commerce/oauth";
import { OAUTH_CORS, oauthFailure, oauthJson, readForm } from "@/lib/commerce/oauth-http";

export async function POST(req: Request) {
  try {
    const form = await readForm(req);
    return oauthJson(await exchangeToken(await commerceEnv(), oauthOrigin(), form, req.headers.get("authorization")));
  } catch (error) { return oauthFailure(error); }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS });
}
