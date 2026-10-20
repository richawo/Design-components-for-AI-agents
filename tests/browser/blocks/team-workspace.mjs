import { check as checkComposition } from "../review/block-team-composition.mjs";
import { check as checkLongMention } from "../review/block-team-long-mention.mjs";
import { check as checkSerialization } from "../review/block-team-serialization.mjs";
import { check as checkJourney } from "../review/block-team-journey.mjs";
import { check as checkToolbarFocus } from "../review/block-team-toolbar-focus.mjs";
import { check as checkMotion } from "../review/block-team-live-motion.mjs";
import { check as checkPopovers } from "../review/block-team-live-popovers.mjs";
import { check as checkPlacement } from "../review/block-team-picker-placement.mjs";
import { check as checkMessages } from "../review/block-team-messages.mjs";
import { check as checkState } from "../review/block-team-state.mjs";
import { check as checkIdentities } from "../review/block-team-identities.mjs";
import { check as checkShortcut } from "../review/block-team-shortcut.mjs";
import { check as checkFocus } from "../review/block-team-focus.mjs";
import { check as checkFocusCommit } from "../review/block-team-focus-commit.mjs";
import { check as checkErrors } from "../review/block-team-errors.mjs";
export async function check(context) {
  for (const theme of ["dark", "light"]) {
    const mount = code => context.mount(code.replaceAll("<Subject.TeamWorkspace", '<Subject.TeamWorkspace theme="' + theme + '" ').replaceAll("<Subject.default", '<Subject.default theme="' + theme + '" '));
    const themed = { ...context, mount };
    await checkMessages(themed);
    await checkState(themed);
    await checkIdentities(themed);
    await checkShortcut(themed);
    await checkFocus(themed);
    await checkFocusCommit(themed);
    await checkToolbarFocus(themed);
    await checkErrors(themed);
    await checkMotion(themed);
    await checkPopovers(themed);
    await checkPlacement(themed);
    await checkComposition(themed);
    await checkLongMention(themed);
    await checkSerialization(themed);
    await checkJourney(themed);
  }
}
