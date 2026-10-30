import { cataloguePath } from "@/lib/catalogue-path";
import { componentGuide, guideMarkdown } from "@/lib/component-guidance";
import { controlsSection } from "@/lib/demo/describe";
import { fileNameFor, installText } from "@/lib/install";
import { getComponent, readSource } from "@/lib/registry";
import { CATEGORIES } from "@/lib/registry-types";
import { absoluteUrl } from "@/lib/site";

const tableCell = (value: string) => value.replace(/(\\*)\|/g, (_, slashes: string) => `${slashes}${slashes.length % 2 ? "" : "\\"}|`);

/** Markdown twin of a component page: /components/<slug>.md */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const e = getComponent(slug);
  if (!e) return new Response("Not found", { status: 404 });
  const src = e.tier === "free" ? await readSource(slug) : null;
  const md = [
    "---",
    `title: ${JSON.stringify(e.name)}`,
    `canonical: ${absoluteUrl(cataloguePath(e))}`,
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
    ...(e.kind === "block"
      ? [
          "## Built from",
          "",
          ...(e.components ?? [])
            .map((id) => getComponent(id))
            .filter(Boolean)
            .map(
              (child) =>
                `- [${child!.name}](${absoluteUrl(`${cataloguePath(child!)}.md`)})`,
            ),
          "",
        ]
      : []),
    ...guideMarkdown(componentGuide(slug)),
    "## Installation",
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
    "## API reference",
    "",
    "| Prop | Type | Default | Description |",
    "| --- | --- | --- | --- |",
    ...e.props.map(
      (p) =>
        `| \`${p.name}\` | \`${tableCell(p.type)}\` | ${p.default ? `\`${tableCell(p.default)}\`` : "None"} | ${tableCell(p.description)} |`,
    ),
    "",
    ...(e.controls?.length ? [...controlsSection(e.controls), ""] : []),
    "## Notes for AI",
    "",
    `Use this reference to choose the component and preserve its public prop contract. Connect your agent at ${absoluteUrl("/docs/agents")}.`,
    "",
    "## Related components",
    "",
    ...componentGuide(slug)
      .related.map((id) => getComponent(id))
      .filter(Boolean)
      .map(
        (item) =>
          `- [${item!.name}](${absoluteUrl(`${cataloguePath(item!)}.md`)}): ${item!.description}`,
      ),
    "",
    ...(src
      ? [
          "## Prompt",
          "",
          src.prompt.trim(),
          "",
          "## JSON prompt",
          "",
          "```json",
          src.promptJson.trim(),
          "```",
          "",
          `## Source (${fileNameFor(e)})`,
          "",
          "```tsx",
          src.code.trim(),
          "```",
          "",
        ]
      : [
          "## Prompt and source",
          "",
          `This is a Pro component. Its code, prompt and JSON prompt are available with a licence: ${absoluteUrl("/pricing")}`,
          "",
        ]),
  ].join("\n");
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      Link: `<${absoluteUrl(cataloguePath(e))}>; rel="canonical"`,
    },
  });
}
