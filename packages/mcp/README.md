# design-for-ai-mcp

An MCP server for [Design for AI](https://design.yaps.ai), the library of design components for AI agents. Your agent can search the library, read a component's design prompt and JSON prompt, and install it without leaving the chat.

## Install

The quickest route needs no install at all: Design for AI also runs as a remote MCP server.

```bash
claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp
```

This package is the same tools over stdio, for clients or networks that prefer a local process:

```bash
# Claude Code
claude mcp add design-for-ai -- npx -y https://design.yaps.ai/mcp.tgz
```

Cursor, Windsurf and other MCP clients:

```json
{
  "mcpServers": {
    "design-for-ai": {
      "command": "npx",
      "args": ["-y", "https://design.yaps.ai/mcp.tgz"],
      "env": { "DESIGN_FOR_AI_LICENSE": "dfa_…" }
    }
  }
}
```

`DESIGN_FOR_AI_LICENSE` is optional. Without it you get every free component. With a Pro licence you also get the Pro components.

## Tools

| Tool | What it returns |
| --- | --- |
| `search_components` | Components that match a query, category, tier or platform |
| `get_component` | Install command, usage, props, design prompt, JSON prompt and source |
| `list_categories` | Every category with free and Pro counts |
| `get_principles` | The anti-slop design principles and a checklist |
| `install_command` | The exact shadcn (web) or curl (React Native) command |
| `get_page` | Any page of the site as Markdown |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DESIGN_FOR_AI_LICENSE` | (none) | Pro licence key |
| `DESIGN_FOR_AI_URL` | `https://design.yaps.ai` | API base, for self-hosting or local development |

MIT licensed. Pro component source is licensed separately.
