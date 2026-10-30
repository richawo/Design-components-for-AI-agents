export type SiteCorpus = {
  keys: string[];
  server: string[];
  ui: string[];
  scopes: Record<string, string[]>;
  previews: Record<string, string[]>;
};
export function keyOf(text: string): string;
export function siteCorpus(root: string): SiteCorpus;
export function buildSiteI18n(root: string): void;
export function privateSiteTranslationKeys(root: string): Set<string>;
export function loadSiteDictionary(root: string, locale: string, overrides?: { _preserve?: string[]; [key: string]: unknown }): {
  publicDictionary: Record<string, string>;
  privateOverlay: Record<string, string>;
  dictionary: Record<string, string>;
};
