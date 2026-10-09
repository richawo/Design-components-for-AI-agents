import { normalizedEmail, requestEmailCode } from "@/lib/commerce/auth";
import { commerceEnv, commerceFailure, privateJson, requireSameOrigin } from "@/lib/commerce/env";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const { email } = await req.json();
    return privateJson(await requestEmailCode(await commerceEnv(), normalizedEmail(email), req.headers.get("cf-connecting-ip") ?? "unknown"));
  } catch (error) { return commerceFailure(error); }
}
