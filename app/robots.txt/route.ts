import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

// Named groups don't inherit the * rules, so each repeats the disallows.
const DISALLOW = ["/api/", "/account", "/preview/", "/md/"];
const AI_BOTS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended"];

export function GET() {
  const group = (agent: string) => [`User-agent: ${agent}`, "Allow: /", ...DISALLOW.map((d) => `Disallow: ${d}`), "Allow: /api/registry"].join("\n");
  const body = [
    "# Design for AI: design components for AI agents.",
    "# Agents: start with /llms.txt, or use the JSON API at /api/registry.",
    "",
    group("*"),
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "",
    ...AI_BOTS.map(group).flatMap((g) => [g, ""]),
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    `# llms.txt: ${absoluteUrl("/llms.txt")}`,
    `# llms-full.txt: ${absoluteUrl("/llms-full.txt")}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
