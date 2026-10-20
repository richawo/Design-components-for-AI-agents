import { check as checkFlags } from "../review/block-people-authoritative-flags.mjs";
import { check as checkArrivals } from "../review/block-people-arrivals.mjs";
import { check as checkWriters } from "../review/block-people-writers.mjs";
import { check as checkSelection } from "../review/block-people-selection.mjs";
import { check as checkRecovery } from "../review/block-people-recovery.mjs";
import { check as checkCrossDepartment } from "../review/block-people-cross-department.mjs";
import { check as checkEdges } from "../review/block-people-edges.mjs";
import { check as checkMotion } from "../review/block-people-motion.mjs";
export async function check(context) {
  for (const check of [checkSelection, checkWriters, checkArrivals, checkFlags, checkRecovery, checkCrossDepartment, checkEdges, checkMotion]) {
    await check(context);
  }
}
