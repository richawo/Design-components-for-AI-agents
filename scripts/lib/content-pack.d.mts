export type PackedContent = { encoding: string; data: string };
export function packContent(content: unknown): PackedContent;
export function unpackContent(packed: PackedContent): unknown;
