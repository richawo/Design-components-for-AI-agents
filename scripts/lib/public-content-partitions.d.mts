import type { PackedContent } from "./content-pack.mjs";
type LocalePartition = { files: string[]; packed: PackedContent };
type PublicContentFields = {
  fields: string[];
  core: PackedContent;
};
export type PartitionedPublicContent = PublicContentFields & (
  { encoding: "partitioned-public-v1"; locales: Record<string, LocalePartition> }
  | { encoding: "partitioned-public-v2"; locales: Record<string, { files: string[]; partitions: LocalePartition[] }> }
);
export function packPublicContent(content: Record<string, unknown>): PublicContentFields & { encoding: "partitioned-public-v2"; locales: Record<string, { files: string[]; partitions: LocalePartition[] }> };
export function publicContentPayloads(packed: PackedContent | PartitionedPublicContent): PackedContent[];
export function createPublicContent(packed: PackedContent | PartitionedPublicContent): unknown;
