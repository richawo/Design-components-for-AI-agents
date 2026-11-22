export type RouterManifestPack = {
  code: string;
  packed: boolean;
  manifestSha256: string;
  manifestBytes: number;
  literalBytes: number;
  routes: number;
  beforeBytes: number;
  afterBytes: number;
  encoding?: string;
  packedBytes?: number;
};
export function packRouterManifest(source: string, expectedManifest: unknown, options?: { minimumBytes?: number }): RouterManifestPack;
