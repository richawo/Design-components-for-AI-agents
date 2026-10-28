import "server-only";
import { unpackContent, type PackedContent } from "@/scripts/lib/content-pack.mjs";
import { styledLoaders } from "@/registry/__generated__/visual-styles";
import type { ComponentSource, RegistryEntry } from "./registry-types";
import { readSource } from "./registry";
import { fileNameFor } from "./install";
import type { VisualStyle } from "./visual-styles";

export type StyledSource = ComponentSource & {
  visualStyle: "crayon";
  styleCss: string;
  font: { family: string; url: string; weight: string };
};
/** Call only after checking paid entitlement for every non-original style. */
export async function readVisualSource(slug: string, style: VisualStyle): Promise<ComponentSource | StyledSource | null> {
  if (style === "original") return readSource(slug);
  const load = Object.hasOwn(styledLoaders, slug) ? styledLoaders[slug] : undefined;
  return load ? unpackContent((await load()).default as PackedContent) as StyledSource : null;
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
