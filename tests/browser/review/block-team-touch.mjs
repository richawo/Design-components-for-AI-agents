import { check as checkMotion } from "./block-team-live-motion.mjs";
import { check as checkPopovers } from "./block-team-live-popovers.mjs";
import { check as checkPlacement } from "./block-team-picker-placement.mjs";

export async function check(context) {
  await checkMotion(context);
  await checkPopovers(context);
  await checkPlacement(context);
}
