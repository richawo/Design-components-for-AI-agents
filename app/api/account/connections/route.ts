import { requireUser } from "@/lib/commerce/auth";
import { commerceEnv, commerceFailure, privateJson, requireSameOrigin } from "@/lib/commerce/env";
import { disconnect, listConnections } from "@/lib/commerce/oauth";

/** Ends one agent connection: its access and refresh tokens stop working immediately. */
export async function DELETE(req: Request) {
  try {
    requireSameOrigin(req);
    const env = await commerceEnv(), user = await requireUser(env, req);
    const { id } = await req.json();
    await disconnect(env, user, id);
    return privateJson({ connections: await listConnections(env, user) });
  } catch (error) { return commerceFailure(error); }
}
