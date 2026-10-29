import "server-only";
import {restoreStyleSource,type StyleDelta} from "@/scripts/lib/style-delta.mjs";
import { unpackContent, type PackedContent } from "@/scripts/lib/content-pack.mjs";
import { styledLoaders, loadSharedStyle } from "@/registry/__generated__/visual-styles";
import type { ComponentSource, RegistryEntry } from "./registry-types";
import { readSource } from "./registry";
import { fileNameFor } from "./install";
import type { VisualStyle } from "./visual-styles";
import type { StyleTheme } from "./visual-styles";
import { selectStyleTheme } from "@/scripts/lib/style-theme.mjs";

export type StyledSource = ComponentSource & {
  visualStyle: "crayon";
  styleCss: string;
  font: { family: string; url: string; weight: string };
  styleRuntime?: string;
  styleRuntimeSha256?: string;
  styleOptions?: Record<string,string>;
};
/** Call only after checking paid entitlement for every non-original style. */
export async function readVisualSource(slug: string, style: VisualStyle, theme: StyleTheme = "light"): Promise<ComponentSource | StyledSource | null> {
  if (style === "original") return readSource(slug);
  const load = Object.hasOwn(styledLoaders, slug) ? styledLoaders[slug] : undefined;
  if(!load)return null;
  const packed=unpackContent((await load()).default as PackedContent) as StyleDelta|StyledSource;
  if("format" in packed && (packed.format === "dfa-style-delta-v1"||packed.format === "dfa-style-delta-v2")){const base=await readSource(slug);const shared=packed.format==="dfa-style-delta-v2"?unpackContent((await loadSharedStyle()).default as PackedContent) as Record<string,string>:null;return base?selectStyleTheme(restoreStyleSource(base,packed,shared) as StyledSource,theme):null;}
  return selectStyleTheme(packed as StyledSource,theme);
}
export function styleRegistryItem(entry: RegistryEntry, source: ComponentSource) {
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: entry.slug,
    type: "registry:component",
    title: entry.name + " · Crayon",
    description: entry.description,
    dependencies: entry.dependencies,
    registryDependencies: entry.platform === "mobile" ? [] : ["https://design.yaps.ai/r/theme.json"],
    files: [{ path: fileNameFor(entry), target: fileNameFor(entry), type: "registry:component", content: source.code }],
  };
}
