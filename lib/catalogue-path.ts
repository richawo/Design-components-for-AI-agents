import type { ComponentMeta } from "./registry-types";

export const isBlock = (entry: Pick<ComponentMeta, "kind">) =>
  entry.kind === "block";
export const cataloguePath = (entry: Pick<ComponentMeta, "slug" | "kind">) =>
  `${isBlock(entry) ? "/blocks" : "/components"}/${entry.slug}`;

export const BLOCK_LABELS = {
  dashboard: "Dashboards",
  report: "Reports",
  settings: "Settings",
  "landing-page": "Landing pages",
  workspace: "Workspaces",
} as const;
