import type { ComponentMeta } from "./registry-types";

export const isBlock = (entry: Pick<ComponentMeta, "kind">) =>
  entry.kind === "block";
export const cataloguePath = (entry: Pick<ComponentMeta, "slug" | "kind">) =>
  `${isBlock(entry) ? "/blocks" : "/components"}/${entry.slug}`;

export { BLOCK_LABELS } from "./block-types.mjs";
