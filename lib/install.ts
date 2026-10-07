import type { RegistryEntry } from "./registry-types";
import { site } from "./site";

/** The install instructions shown on a component page and served to agents. */
export function installText(e: Pick<RegistryEntry, "slug" | "tier" | "platform">): string {
  const { slug, tier, platform } = e;
  if (platform === "mobile") {
    const auth = tier === "pro" ? ` \\\n  -H "Authorization: Bearer $DESIGN_FOR_AI_LICENSE"` : "";
    return [
      "# React Native: one file, core APIs only, no extra dependencies",
      `curl --create-dirs -o components/design-for-ai/native/${slug}.tsx${auth} \\`,
      `  "${site.url}/api/registry/${slug}?format=raw"`,
      "",
      "# Or ask your agent (with the Design for AI MCP server installed):",
      `#   "Add the Design for AI component ${slug}"`,
    ].join("\n");
  }
  if (tier === "pro") {
    return [
      "# 1. Once per project, add the Pro registry to components.json:",
      '#    "registries": {',
      '#      "@design-for-ai-pro": {',
      `#        "url": "${site.url}/r/pro/{name}.json",`,
      '#        "headers": { "Authorization": "Bearer ${DESIGN_FOR_AI_LICENSE}" }',
      "#      }",
      "#    }",
      "# 2. Then:",
      `npx shadcn@latest add @design-for-ai-pro/${slug}`,
      "",
      "# Or ask your agent (with the Design for AI MCP server installed):",
      `#   "Add the Design for AI component ${slug}"`,
    ].join("\n");
  }
  return [
    `npx shadcn@latest add ${site.url}/r/${slug}.json`,
    "",
    "# Or ask your agent (with the Design for AI MCP server installed):",
    `#   "Add the Design for AI component ${slug}"`,
  ].join("\n");
}

export function fileNameFor(e: Pick<RegistryEntry, "slug" | "platform">) {
  return e.platform === "mobile" ? `components/design-for-ai/native/${e.slug}.tsx` : `components/design-for-ai/${e.slug}.tsx`;
}
