export const PUBLIC_CONTENT_PACKAGE: string;
export function writePublicContentRuntime(root: string, packed: import("./content-pack.mjs").PackedContent | import("./public-content-partitions.mjs").PartitionedPublicContent): string;
export function assertSinglePublicContentCopy(serverSource: string, packed: { data: string } | import("./public-content-partitions.mjs").PartitionedPublicContent): number;
