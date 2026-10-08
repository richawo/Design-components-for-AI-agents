import { allComponents, readSource } from "@/lib/registry";
import { installText } from "@/lib/install";
import { absoluteUrl, site } from "@/lib/site";

export const dynamic = "force-static";

/** Every free component's brief, prompt and JSON prompt. Pro prompts are licensed and excluded. */
export async function GET() {
  const parts = [`# ${site.name}: full prompts`, "", `> ${site.description}`, "", "Pro components are listed with their description only; their prompts need a licence.", ""];
  for (const e of allComponents()) {
    parts.push(`## ${e.name} (\`${e.slug}\`)`, "", `- URL: ${absoluteUrl(`/components/${e.slug}`)}`, `- Tier: ${e.tier}`, `- Platform: ${e.platform}`, `- Category: ${e.category}`, `- ${e.description}`, "");
    if (e.tier !== "free") continue;
    const src = await readSource(e.slug);
    if (!src) continue;
    parts.push("### Install", "", "```bash", installText(e), "```", "", "### Prompt", "", src.prompt.trim(), "", "### JSON prompt", "", "```json", src.promptJson.trim(), "```", "");
  }
  return new Response(parts.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, follow" } });
}
