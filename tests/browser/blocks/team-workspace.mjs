import { check as checkMessages } from "../review/block-team-messages.mjs";
import { check as checkState } from "../review/block-team-state.mjs";
import { check as checkIdentities } from "../review/block-team-identities.mjs";
import { check as checkShortcut } from "../review/block-team-shortcut.mjs";
export async function check(context) {
  for (const theme of ["dark", "light"]) {
    const mount = code => context.mount(code.replaceAll("<Subject.TeamWorkspace", '<Subject.TeamWorkspace theme="' + theme + '" '));
    const themed = { ...context, mount };
    await checkMessages(themed);
    await checkState(themed);
    await checkIdentities(themed);
    await checkShortcut(themed);
  }
}
