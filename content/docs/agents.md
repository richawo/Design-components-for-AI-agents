---
title: AI agents & MCP
description: Connect Claude Code, Cursor, Windsurf and other agents to Design for AI with the MCP server, the agent skill, the JSON API and llms.txt.
order: 3
section: For agents
---

Design for AI is built so an agent can find, read and install components without scraping a web page. There are four ways in; most people use the MCP server.

## MCP server

The MCP server gives your agent five tools:

| Tool | What it does |
| --- | --- |
| `search_components` | Search by keyword, category, tier or platform |
| `get_component` | Code, prompt, JSON prompt, props and install command for one component |
| `list_categories` | Every category with counts |
| `get_principles` | The anti-slop design principles, to use as a system prompt |
| `install_command` | The exact command to add a component to the current project |

### Claude Code

```bash
claude mcp add design-for-ai -- npx -y design-for-ai-mcp
```

### Cursor, Windsurf and others

Add this to your MCP config (`.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, and so on):

```json
{
  "mcpServers": {
    "design-for-ai": {
      "command": "npx",
      "args": ["-y", "design-for-ai-mcp"],
      "env": { "DESIGN_FOR_AI_LICENSE": "dfa_…" }
    }
  }
}
```

`DESIGN_FOR_AI_LICENSE` is optional. Without it, the server serves free components and tells the agent when something is Pro.

### Prompts that work well

- "Use Design for AI to build a landing page for this product. Pick a hero, a feature section and pricing that suit the brand, and adapt their colours to our palette."
- "Find a Design for AI component for an agent run log and add it to the dashboard."
- "Read Design for AI's design principles, then review this page and list everything that looks generated."

## Agent skill

The repository includes a Claude skill at `skills/design-for-ai/SKILL.md`. It teaches an agent the anti-slop principles, when to reach for a Design for AI component, and how to adapt one without flattening it back into the average. Copy the folder into `.claude/skills/` in your project, or `~/.claude/skills/` for every project.

## JSON API

Everything the MCP server does goes through a plain HTTP API, so you can script it too:

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
- Every component and blog post has a Markdown twin: add `.md` to the URL, as in [`/components/chart-portfolio.md`](/components/chart-portfolio.md).
