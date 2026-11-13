import "server-only";

import { Marked } from "marked";
import { cataloguePath } from "@/lib/catalogue-path";
import { getComponent, toCard } from "@/lib/registry";

// These guides discuss several components. Choose the one that best shows
// the workflow in the guide, even when a general example is linked first.
const featuredComponents: Record<string, string> = {
  "aceternity-ui-alternatives": "saas-workspace-dashboard",
  "magic-ui-alternatives": "chart-waffle",
  "react-components-existing-design-system": "editor-color-token-studio",
  "react-legal-case-management-ui": "legal-matter-dashboard",
  "shadcn-studio-alternatives": "block-legal-workspace",
};

export function blogExampleComponent(sourceSlug: string, markdown: string) {
  const candidates = new Set<string>();
  const featured = featuredComponents[sourceSlug];
  if (featured) candidates.add(featured);
  const parser = new Marked({ gfm: true });
  parser.walkTokens(parser.lexer(markdown), (token) => {
    if (token.type !== "link") return;
    const match = /^(?:https:\/\/design\.yaps\.ai)?\/(?:components|blocks)\/([a-z0-9-]+)(?:[?#].*)?$/.exec(token.href);
    if (match) candidates.add(match[1]);
  });
  for (const slug of candidates) {
    const component = getComponent(slug);
    if (component) return { path: cataloguePath(component), ...toCard(component) };
  }
  return null;
}
