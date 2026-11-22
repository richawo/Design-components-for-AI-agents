import type { PackedContent } from "./content-pack.mjs";
export type PartitionedPublicContent = {
  encoding: "partitioned-public-v1";
  fields: string[];
  core: PackedContent;
  locales: Record<string, { files: string[]; packed: PackedContent }>;
};
export function packPublicContent(content: Record<string, unknown>): PartitionedPublicContent;
export function publicContentPayloads(packed: PackedContent | PartitionedPublicContent): PackedContent[];
export function createPublicContent(packed: PackedContent | PartitionedPublicContent): unknown;
