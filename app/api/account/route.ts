import { sessionUser } from "@/lib/commerce/auth";
import { accountDetails } from "@/lib/commerce/licences";
import { commerceEnv, commerceFailure, privateJson } from "@/lib/commerce/env";

export async function GET(req: Request) {
  try {
    const env = await commerceEnv(), user = await sessionUser(env, req);
    return privateJson(user ? await accountDetails(env, user) : { user: null, licences: [], hasBilling: false });
  }
  catch (error) { return commerceFailure(error); }
}
