import type { ComponentControl, PropDoc } from "./registry-types";

export type PreviewAccent = { prop?: string; variables: string[] };
/** Only documented brand accents. Never infer colours from data or status tokens. */
export function previewAccent(code: string, controls: ComponentControl[], props: PropDoc[]): PreviewAccent {
  const names = new Set(props.map(p => p.name));
  if (/\baccent\??:\s*string\b/.test(code)) names.add("accent");
  const colors = new Set(controls.filter(c => c.kind === "color").map(c => c.prop));
  const prop = ["accent", "stampColor", "flashColor", "color"].find(name => colors.has(name) || (name === "accent" && names.has(name)));
  const variables = [...new Set([...code.matchAll(/--(?:[a-z][a-z0-9]*-)*accent\b/g)].map(match => match[0]))];
  return { prop, variables };
}
