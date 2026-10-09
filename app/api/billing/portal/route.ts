import { requireUser } from "@/lib/commerce/auth";
import { billingPortal } from "@/lib/commerce/billing";
import { commerceEnv, commerceFailure, privateJson, requireSameOrigin } from "@/lib/commerce/env";

export async function POST(req: Request) {
  try { requireSameOrigin(req); const env = await commerceEnv(); return privateJson({ url: await billingPortal(env, await requireUser(env, req)) }); }
  catch (error) { return commerceFailure(error); }
}
