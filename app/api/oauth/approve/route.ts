import { requireUser } from "@/lib/commerce/auth";
import { CommerceError, commerceEnv, commerceFailure, privateJson, requireSameOrigin } from "@/lib/commerce/env";
import { checkAuthorization, errorRedirect, issueCode, oauthOrigin } from "@/lib/commerce/oauth";

/**
 * The consent page's decision. The original authorization request is checked
 * again here, so nothing the page displayed is trusted. Same-origin JSON plus
 * the session cookie make this unforgeable from another site.
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const env = await commerceEnv(), user = await requireUser(env, req);
    const { query, approve } = await req.json();
    if (typeof query !== "string" || query.length > 8000) throw new CommerceError(400, "This sign-in link is incomplete. Start again from your agent.");
    const check = await checkAuthorization(env, oauthOrigin(), new URLSearchParams(query));
    if (!check.ok) {
      if ("fatal" in check) throw new CommerceError(400, check.fatal);
      return privateJson({ redirect: check.redirect });
    }
    const redirect = approve === true
      ? await issueCode(env, user, check.request)
      : errorRedirect(check.request.redirectUri, check.request.state, "access_denied", "The user declined access.");
    return privateJson({ redirect });
  } catch (error) { return commerceFailure(error); }
}
