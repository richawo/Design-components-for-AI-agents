import { check as checkMessages } from "../review/block-team-messages.mjs";
import { check as checkState } from "../review/block-team-state.mjs";
import { check as checkIdentities } from "../review/block-team-identities.mjs";
import { check as checkShortcut } from "../review/block-team-shortcut.mjs";
import { check as checkFocus } from "../review/block-team-focus.mjs";
import { check as checkFocusCommit } from "../review/block-team-focus-commit.mjs";
import { check as checkErrors } from "../review/block-team-errors.mjs";
export async function check(context) {
  for (const theme of ["dark", "light"]) {
    const mount = code => context.mount(code.replaceAll("<Subject.TeamWorkspace", '<Subject.TeamWorkspace theme="' + theme + '" '));
    const themed = { ...context, mount };
    await checkMessages(themed);
    await checkState(themed);
    await checkIdentities(themed);
    await checkShortcut(themed);
    await checkFocus(themed);
    await checkFocusCommit(themed);
    await checkErrors(themed);
  }
}
