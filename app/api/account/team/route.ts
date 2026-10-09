import { requireUser } from "@/lib/commerce/auth";
import { commerceEnv, commerceFailure, privateJson, requireSameOrigin, CommerceError } from "@/lib/commerce/env";
import { inviteMember, removeMember } from "@/lib/commerce/team";

async function update(req: Request, remove: boolean) {
  try {
    requireSameOrigin(req);
    const env = await commerceEnv(), user = await requireUser(env, req);
    const { licenceId, email } = await req.json();
    if (typeof licenceId !== "string" || licenceId.length > 100) throw new CommerceError(400, "Choose a valid licence.");
    return privateJson(await (remove ? removeMember : inviteMember)(env, user, licenceId, email));
  } catch (error) { return commerceFailure(error); }
}
export const POST = (req: Request) => update(req, false);
export const DELETE = (req: Request) => update(req, true);
