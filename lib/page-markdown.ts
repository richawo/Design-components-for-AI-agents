import "server-only";
import { allDocs, allPosts, getDoc } from "./content";
import { HOME_FAQ, PRICING_FAQ, planFeatures } from "./copy";
import { installText } from "./install";
import { PLANS } from "./pricing";
import { categoriesWithCounts, componentsIn, stats } from "./registry";
import { CATEGORIES, type Category, type RegistryEntry } from "./registry-types";
import { absoluteUrl, site } from "./site";

/**
 * Markdown twins of the site's pages, for agents and anyone who'd rather
 * read than browse: append `.md` to any URL (`/pricing.md`, `/docs/agents.md`,
 * `/categories/charts.md`, `/index.md` for the home page). Component pages and
 * blog posts have their own routes with the full source and article.
 */

const front = (title: string, path: string, description?: string) =>
  ["---", `title: ${JSON.stringify(title)}`, ...(description ? [`description: ${JSON.stringify(description)}`] : []), `canonical: ${absoluteUrl(path)}`, "---", ""].join("\n");

const row = (e: RegistryEntry) =>
  `- [${e.name}](${absoluteUrl(`/components/${e.slug}.md`)}) \`${e.slug}\` · ${e.tier === "pro" ? "Pro" : "Free"}${e.platform === "mobile" ? " · React Native" : ""}: ${e.description}`;

const faq = (items: { q: string; a: string }[]) => items.flatMap((x) => [`### ${x.q}`, "", x.a, ""]);

const quickStart = () => [
  "## Install",
  "",
  "```bash",
  "# One component with the shadcn CLI (free components)",
  `npx shadcn@latest add ${absoluteUrl("/r/chart-portfolio.json")}`,
  "",
  "# Search, read and add components from the terminal",
  "npx design-for-ai search pricing",
  "npx design-for-ai add chart-portfolio",
  "",
  "# Connect your agent over MCP (Claude Code shown; any MCP client works)",
  `claude mcp add --transport http design-for-ai ${absoluteUrl("/mcp")}`,
  "```",
  "",
  `Pro components need a licence key: set \`DESIGN_FOR_AI_LICENSE\` (CLI, local MCP server) or send \`Authorization: Bearer <key>\` (API, remote MCP, shadcn registry). More in [Installation](${absoluteUrl("/docs/installation.md")}) and [AI agents & MCP](${absoluteUrl("/docs/agents.md")}).`,
  "",
];

async function home() {
  const s = stats();
  return [
    front(`${site.name}: ${site.tagline}`, "/", site.description),
    `# ${site.tagline}`,
    "",
    site.description,
    "",
    `${s.total} components: ${s.free} free (MIT) and ${s.pro} Pro, ${s.mobile} of them React Native. Every component ships three ways: a single self-contained source file, a design prompt written like a design director's brief, and the same brief as a JSON prompt.`,
    "",
    ...quickStart(),
    "## Browse by category",
    "",
    ...categoriesWithCounts().map((c) => `- [${c.label}](${absoluteUrl(`/categories/${c.key}.md`)}) (${c.count}): ${c.blurb}`),
    "",
    `Everything in one list: [all components](${absoluteUrl("/components.md")}). For a map built for language models, see [llms.txt](${absoluteUrl("/llms.txt")}).`,
    "",
    "## Frequently asked questions",
    "",
    ...faq(HOME_FAQ),
  ].join("\n");
}

async function componentsIndex() {
  const s = stats();
  return [
    front("All components", "/components", `${s.total} components, every one with code, a prompt and a JSON prompt.`),
    `# ${s.total} components`,
    "",
    `${s.free} free and open source, ${s.pro} Pro, ${s.mobile} React Native. Each links to its Markdown page with install command, props, prompt and (for free components) the full source.`,
    "",
    ...categoriesWithCounts().flatMap((c) => [`## ${c.label}`, "", c.blurb, "", ...componentsIn(c.key).map(row), ""]),
  ].join("\n");
}

async function category(key: Category) {
  const c = CATEGORIES[key];
  const list = componentsIn(key);
  return [
    front(c.label, `/categories/${key}`, c.blurb),
    `# ${c.label}`,
    "",
    c.blurb,
    "",
    `${list.length} ${list.length === 1 ? c.noun : `${c.noun}s`}:`,
    "",
    ...list.map(row),
    "",
    "## Install any of them",
    "",
    "```bash",
    ...list.slice(0, 3).map((e) => installText(e)),
    "```",
    "",
  ].join("\n");
}

async function pricing() {
  const s = stats();
  const price = (id: string) => PLANS.find((p) => p.id === id)!.price;
  const once = planFeatures(s, "lifetime");
  const yearly = planFeatures(s, "yearly");
  return [
    front("Pricing", "/pricing", "Free and open source, or Pro once and for good."),
    "# Pricing",
    "",
    `${s.free} components are free and always will be. Pro unlocks the other ${s.pro}, their prompts and the private registry, yearly or with one payment that covers every future release.`,
    "",
    "| Plan | Pay once | Yearly | Seats |",
    "| --- | --- | --- | --- |",
    `| Free | $0 | $0 | 1 |`,
    `| Pro | $${price("pro-lifetime")} | $${price("pro-yearly")} / year | 1 |`,
    `| Team | $${price("team-lifetime")} | $${price("team-yearly")} / year | up to 10 |`,
    "",
    "## Free",
    "",
    ...once.free.map((f) => `- ${f}`),
    "",
    "## Pro",
    "",
    ...once.pro.map((f) => `- ${f}`),
    `- Yearly instead: ${yearly.pro[4].toLowerCase()}`,
    "",
    "## Team",
    "",
    ...once.team.map((f) => `- ${f}`),
    "",
    `Buy at ${absoluteUrl("/pricing")}.`,
    "",
    "## Frequently asked questions",
    "",
    ...faq(PRICING_FAQ),
  ].join("\n");
}

async function doc(slug: string) {
  const d = await getDoc(slug);
  if (!d) return null;
  const path = slug === "introduction" ? "/docs" : `/docs/${slug}`;
  const others = allDocs().filter((x) => x.slug !== slug);
  return [
    front(d.meta.title, path, d.meta.description),
    `# ${d.meta.title}`,
    "",
    d.markdown.trim(),
    "",
    "## More docs",
    "",
    ...others.map((x) => `- [${x.title}](${absoluteUrl(x.slug === "introduction" ? "/docs.md" : `/docs/${x.slug}.md`)}): ${x.description}`),
    "",
  ].join("\n");
}

async function blog() {
  return [
    front("Blog", "/blog", "Notes on designing with AI agents."),
    "# Blog",
    "",
    ...allPosts().flatMap((p) => [`## [${p.title}](${absoluteUrl(`/blog/${p.slug}.md`)})`, "", `${p.date} · ${p.readingTime} min read`, "", p.description, ""]),
  ].join("\n");
}

async function account() {
  return [
    front("Your licence", "/account"),
    "# Your licence",
    "",
    `This page activates a Pro or Team licence in a browser and shows the key for agents. It's personal, so its live contents aren't available as Markdown.`,
    "",
    "- After checkout you land here with the licence active and the key shown. Copy it somewhere safe.",
    "- To use Pro on another device, open this page there and paste the key (it starts with `dfa_`).",
    "- For agents and tools, set `DESIGN_FOR_AI_LICENSE` to the key, or send `Authorization: Bearer <key>`.",
    "",
    `No licence yet? See [pricing](${absoluteUrl("/pricing.md")}).`,
    "",
  ].join("\n");
}

/** Every page path (without leading slash) that has a Markdown twin here. */
export function markdownPagePaths(): string[] {
  return [
    "index",
    "components",
    "pricing",
    "docs",
    ...allDocs()
      .filter((d) => d.slug !== "introduction")
      .map((d) => `docs/${d.slug}`),
    "blog",
    "account",
    ...categoriesWithCounts().map((c) => `categories/${c.key}`),
  ];
}

export async function markdownForPage(path: string): Promise<string | null> {
  const p = path.replace(/^\/+|\/+$/g, "") || "index";
  if (p === "index") return home();
  if (p === "components") return componentsIndex();
  if (p === "pricing") return pricing();
  if (p === "docs") return doc("introduction");
  if (p === "blog") return blog();
  if (p === "account") return account();
  const [section, slug, ...rest] = p.split("/");
  if (rest.length || !slug) return null;
  if (section === "docs") return doc(slug);
  if (section === "categories" && slug in CATEGORIES && componentsIn(slug as Category).length) return category(slug as Category);
  return null;
}
