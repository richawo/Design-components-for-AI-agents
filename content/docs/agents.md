---
title: AI agents & MCP
description: Connect Claude Code, Cursor, Windsurf and other agents to Design for AI with the remote MCP server, the CLI, the agent skill, the JSON API and Markdown twins of every page.
order: 3
section: For agents
---

Design for AI is built so an agent can find, read and install components without scraping a web page. There are five ways in: the remote MCP server is the quickest.

## MCP server (remote)

The site itself is an MCP server. Nothing to install or keep up to date: point your client at `https://design.yaps.ai/mcp` (Streamable HTTP). It gives your agent six tools:

| Tool | What it does |
| --- | --- |
| `search_components` | Search by keyword, category, tier or platform |
| `get_component` | Code, design prompt, JSON prompt, props and install command for one component |
| `list_categories` | Every category with counts |
| `get_principles` | The anti-slop design principles, to use as a system prompt |
| `install_command` | The exact command to add a component to the current project |
| `get_page` | Any page of this site as Markdown (pricing, docs, a category) |

### Claude Code

```bash
claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp
```

With a Pro licence, add the header:

```bash
claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp \
  --header "Authorization: Bearer $DESIGN_FOR_AI_LICENSE"
```

### Cursor, Windsurf, VS Code and others

Add this to your MCP config (`.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, `.vscode/mcp.json` and so on):

```json
{
  "mcpServers": {
    "design-for-ai": {
      "url": "https://design.yaps.ai/mcp",
      "headers": { "Authorization": "Bearer ${DESIGN_FOR_AI_LICENSE}" }
    }
  }
}
```

The header is optional. Without it, every free component works and the server tells the agent when something is Pro.

### Prefer a local server?

The same tools run locally over stdio, reading the public API:

```bash
claude mcp add design-for-ai -e DESIGN_FOR_AI_LICENSE=dfa_… -- npx -y design-for-ai-mcp
```

## CLI

For you, or for an agent that would rather run a command than call a tool:

```bash
npx design-for-ai search sign in        # find components
npx design-for-ai info auth-sign-in     # description, install command and props
npx design-for-ai add auth-sign-in      # write the file, install missing dependencies
npx design-for-ai prompt auth-sign-in   # print the design brief (--json for the JSON prompt)
npx design-for-ai login dfa_…           # unlock Pro on this machine
```

`add` writes to `components/design-for-ai/` (or `src/components/design-for-ai/` when you have a `src` folder; override with `--dir`) and installs what the component imports (`motion`, `three`, `lucide-react`) with your package manager.

### Prompts that work well

- "Use Design for AI to build a landing page for this product. Pick a hero, a feature section and pricing that suit the brand, and adapt their colours to our palette."
- "Find a Design for AI component for an agent run log and add it to the dashboard."
- "Read Design for AI's design principles, then review this page and list everything that looks generated."

## Agent skill

The repository includes a Claude skill at `skills/design-for-ai/SKILL.md`. It teaches an agent the anti-slop principles, when to reach for a Design for AI component, and how to adapt one without flattening it back into the average. Copy the folder into `.claude/skills/` in your project, or `~/.claude/skills/` for every project.

## JSON API

The CLI and the local MCP server use a plain HTTP API, so you can script it too:

```bash
# Every component's metadata
curl https://design.yaps.ai/api/registry

# One component: meta, install, code, prompt, promptJson
curl https://design.yaps.ai/api/registry/chart-portfolio

# Just the file
curl "https://design.yaps.ai/api/registry/chart-portfolio?format=raw"
```

Pro components need `Authorization: Bearer $DESIGN_FOR_AI_LICENSE`.

## llms.txt and Markdown

- [`/llms.txt`](/llms.txt) is a concise map of the library for language models.
- [`/llms-full.txt`](/llms-full.txt) contains every free component's prompt and JSON prompt in one file. It's a good thing to drop into a long-context model.
- Every page has a Markdown twin: add `.md` to the URL, as in [`/components/chart-portfolio.md`](/components/chart-portfolio.md), [`/pricing.md`](/pricing.md) or [`/categories/auth.md`](/categories/auth.md). The home page is [`/index.md`](/index.md). Each HTML page also links its twin with `<link rel="alternate" type="text/markdown">`.
