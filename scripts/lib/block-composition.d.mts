export interface CompositionMeta {
  slug: string;
  tier: string;
  platform: string;
  kind?: string;
  blockType?: string;
  components?: string[];
  status?: string;
}
export const BLOCK_TYPES: string[];
export function validateComposition(
  meta: CompositionMeta,
  code: string,
  catalogue: CompositionMeta[],
): string[];
export function installedBlockSource(
  meta: CompositionMeta,
  code: string,
): string;
export function compositionRegistryDependencies(
  meta: CompositionMeta,
  catalogue: CompositionMeta[],
  siteUrl: string,
): string[];
