import { installText } from "./install";
import type { RegistryEntry } from "./registry-types";

export const VISUAL_STYLES = [
  {id:"original",name:"Original",tier:"free",description:"The original component design."},
  {id:"crayon",name:"Crayon",tier:"pro",description:"Paper, expressive handwriting and drawn edges."},
] as const;
export type VisualStyle = typeof VISUAL_STYLES[number]["id"];
export const VISUAL_STYLE_IDS = VISUAL_STYLES.map(style=>style.id);
export function parseVisualStyle(value: unknown): VisualStyle | null {
  return value === undefined || value === null || value === "" ? "original" : VISUAL_STYLE_IDS.includes(value as VisualStyle) ? value as VisualStyle : null;
}
export function supportsVisualStyle(entry: Pick<RegistryEntry, "visualStyles">, style: VisualStyle) {
  return style === "original" || Boolean(entry.visualStyles?.includes(style));
}
export function visualStyleQuery(style: VisualStyle) {
  return style === "original" ? "" : "?visualStyle=" + style;
}

export function styleInstallText(entry: Pick<RegistryEntry,"slug"> & Partial<Pick<RegistryEntry,"platform"|"dependencies">>): string {
  if(entry.platform === "mobile")return installText({...entry,tier:"pro",platform:"mobile"}).replace("?format=raw","?visualStyle=crayon&format=raw") + "\n\n# Crayon headings use native handwritten font fallbacks. Load Caveat as DFA Crayon to use the same custom font as the web preview.";
  return [
    "# Once per project, add this licensed registry to components.json:",
    '# "registries": { "@design-for-ai-crayon": {',
    '#   "url": "https://design.yaps.ai/r/styles/crayon/{name}.json",',
    '#   "headers": { "Authorization": "Bearer ${DESIGN_FOR_AI_LICENSE}" }',
    '# } }',
    `npx shadcn@latest add @design-for-ai-crayon/${entry.slug}`,
    "",
    '# Or ask your connected agent for visualStyle: "crayon".',
  ].join("\n");
}
