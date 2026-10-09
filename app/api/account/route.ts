import { requireUser } from "@/lib/commerce/auth";
import { accountDetails } from "@/lib/commerce/licences";
import { commerceEnv, commerceFailure, privateJson } from "@/lib/commerce/env";

export async function GET(req: Request) {
  try { const env = await commerceEnv(); return privateJson(await accountDetails(env, await requireUser(env, req))); }
  catch (error) { return commerceFailure(error); }
}
