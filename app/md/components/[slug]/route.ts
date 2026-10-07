import { fileNameFor, installText } from "@/lib/install";
import { getComponent, readSource } from "@/lib/registry";
import { CATEGORIES } from "@/lib/registry-types";
import { absoluteUrl } from "@/lib/site";

/** Markdown twin of a component page: /components/<slug>.md */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = getComponent(slug);
  if (!e) return new Response("Not found", { status: 404 });
  const src = e.tier === "free" ? readSource(slug) : null;
  const md = [
    "---",
    `title: ${JSON.stringify(e.name)}`,
    `canonical: ${absoluteUrl(`/components/${slug}`)}`,
    `tier: ${e.tier}`,
    `platform: ${e.platform}`,
    `category: ${e.category}`,
    "---",
    "",
    `# ${e.name}`,
    "",
    e.description,
    "",
    `Category: ${CATEGORIES[e.category].label} · ${e.tier === "free" ? "Free (MIT)" : "Pro"} · ${e.platform === "mobile" ? "React Native" : "React + Tailwind v4"}${e.dependencies.length ? ` · deps: ${e.dependencies.join(", ")}` : ""}`,
    "",
    "## Install",
    "",
    "```bash",
    installText(e),
    "```",
    "",
    "## Usage",
    "",
    "```tsx",
    e.usage,
    "```",
    "",
    "## Props",
    "",
    "| Prop | Type | Default | Description |",
    "| --- | --- | --- | --- |",
    ...e.props.map((p) => `| \`${p.name}\` | \`${p.type.replace(/\|/g, "\\|")}\` | ${p.default ? `\`${p.default}\`` : "—"} | ${p.description} |`),
    "",
    ...(src
      ? ["## Prompt", "", src.prompt.trim(), "", "## JSON prompt", "", "```json", src.promptJson.trim(), "```", "", `## Source (${fileNameFor(e)})`, "", "```tsx", src.code.trim(), "```", ""]
      : ["## Prompt and source", "", `This is a Pro component. Its code, prompt and JSON prompt are available with a licence: ${absoluteUrl("/pricing")}`, ""]),
  ].join("\n");
  return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex, follow", Link: `<${absoluteUrl(`/components/${slug}`)}>; rel="canonical"` } });
}
