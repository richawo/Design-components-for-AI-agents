import { requireUser } from "@/lib/commerce/auth";
import { startCheckout } from "@/lib/commerce/billing";
import { CommerceError, commerceEnv, commerceFailure, privateJson, requireSameOrigin } from "@/lib/commerce/env";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const { plan } = await req.json() as { plan?: string };
    if (typeof plan !== "string") throw new CommerceError(400, "Choose a plan.");
    const env = await commerceEnv();
    let user;
    try { user = await requireUser(env, req); }
    catch (error) {
      if (error instanceof CommerceError && error.status === 401) return privateJson({ error: "Sign in to continue.", signInUrl: `/account?plan=${encodeURIComponent(plan)}` }, 401);
      throw error;
    }
    return privateJson({ url: await startCheckout(env, user, plan) });
  } catch (error) {
    return commerceFailure(error);
  }
}
