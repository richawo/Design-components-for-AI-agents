import {check as workflow} from "../review/block-saas-dashboard-workflow.mjs";
import {check as datesExport} from "../review/block-saas-dashboard-dates-export.mjs";
import {check as selection} from "../review/block-saas-dashboard-selection.mjs";
import {check as reporting} from "../review/block-saas-dashboard-reporting.mjs";
export async function check(context) {
  for (const check of [workflow, datesExport, selection, reporting]) await check(context);
}
