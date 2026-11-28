import type { PackedContent } from "./content-pack.mjs";
import type { PartitionedPublicContent } from "./public-content-partitions.mjs";
type Pack = PackedContent | PartitionedPublicContent;
type Verification = { binaryBytes: number; binarySha256: string; payloads: { offset: number; bytes: number; encoding: string; copies: number; sha256: string }[] };
export const PUBLIC_CONTENT_BINARY: string;
export function prepareBinaryPublicContent(source: string, packed: Pack, options?: { sourceMap?: object; file?: string }): Verification & { code: string; binary: Buffer; map: object | null; encodedBytesBefore: number };
export function assertBinaryPublicContentCopy(source: string, binary: Uint8Array, packed: Pack): Verification;
