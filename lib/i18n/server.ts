import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import bundled from "@/registry/__generated__/site-i18n.json";
import { unpackContent, type PackedContent } from "@/scripts/lib/content-pack.mjs";
import { treeLocalizer } from "./tree";
import type { Dictionary } from "./translate";
import { blogUI } from "@/lib/blog/runtime";

const dictionaries = bundled.dictionaries as Record<string, string>;
const keys = unpackContent(bundled.keys as PackedContent) as string[];
type Bundle = { strings: Dictionary; docs: Record<string, string>; previews: Record<string, string> };
const empty: Bundle = { strings: {}, docs: {}, previews: {} };
const recent = new Map<string, Bundle>();

async function readAsset<T>(url: string): Promise<T> {
  let assets: { fetch: typeof fetch } | undefined;
  try { assets = (getCloudflareContext().env as unknown as { ASSETS?: { fetch: typeof fetch } }).ASSETS; } catch { /* Node build/dev reads the generated asset below. */ }
  if (assets) {
    const response = await assets.fetch(new Request(`https://design.yaps.ai${url}`));
    if (!response.ok) throw new Error(`Missing language asset: ${url}`);
    return await response.json() as T;
  }
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(`${process.cwd()}/public${url}`, "utf8")) as T;
}

const siteBundle = cache(async (locale: string): Promise<Bundle> => {
  if (locale === "en" || !Object.hasOwn(dictionaries, locale)) return empty;
  let bundle = recent.get(locale);
  if (!bundle) {
    const decoded = await readAsset<{ values: string[]; docs: Bundle["docs"]; previews: Bundle["previews"] }>(dictionaries[locale]);
    bundle = { strings: Object.fromEntries(keys.flatMap((key, index) => decoded.values[index] ? [[key, decoded.values[index]]] : [])), docs: decoded.docs, previews: decoded.previews };
  }
  recent.delete(locale); recent.set(locale, bundle);
  if (recent.size > 3) recent.delete(recent.keys().next().value!);
  return bundle;
});
export const siteDictionary = async (locale = "en") => (await siteBundle(locale)).strings;
export const siteDoc = async (locale: string, slug: string) => (await siteBundle(locale)).docs[slug];
const pick = (dictionary: Dictionary, selected: string[]) => Object.fromEntries(selected.filter((key) => Object.hasOwn(dictionary, key)).map((key) => [key, dictionary[key]]));
export const siteCopy = async (locale = "en", scope = "shell", additionalKeys: string[] = []): Promise<Dictionary> => locale === "en" ? {} : ({ ...(scope === "shell" ? blogUI(locale) : {}), ...pick(await siteDictionary(locale), [...((bundled.scopes as Record<string, string[]>)[scope] ?? []), ...additionalKeys]) });
export const previewDictionaryUrl = async (locale: string, slug: string) => (await siteBundle(locale)).previews[slug];
export const entryCopy = cache(async (locale: string, slug: string): Promise<Dictionary> => {
  const url = await previewDictionaryUrl(locale, slug);
  return url ? readAsset<Dictionary>(url) : {};
});
export const serverI18n = async (locale = "en") => treeLocalizer(locale, await siteDictionary(locale));
