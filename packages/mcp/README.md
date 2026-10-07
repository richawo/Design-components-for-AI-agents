# design-for-ai-mcp

An MCP server for [Design for AI](https://design.yaps.ai), the library of design components for AI agents. Your agent can search the library, read a component's design prompt and JSON prompt, and install it without leaving the chat.

## Install

```bash
# Claude Code
claude mcp add design-for-ai -- npx -y design-for-ai-mcp
```

Cursor, Windsurf and other MCP clients:

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

`DESIGN_FOR_AI_LICENSE` is optional. Without it you get every free component. With a Pro licence you also get the Pro components.

## Tools

| Tool | What it returns |
| --- | --- |
| `search_components` | Components that match a query, category, tier or platform |
| `get_component` | Install command, usage, props, design prompt, JSON prompt and source |
| `list_categories` | Every category with free and Pro counts |
| `get_principles` | The anti-slop design principles and a checklist |
| `install_command` | The exact shadcn (web) or curl (React Native) command |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DESIGN_FOR_AI_LICENSE` | (none) | Pro licence key |
| `DESIGN_FOR_AI_URL` | `https://design.yaps.ai` | API base, for self-hosting or local development |

MIT licensed. Pro component source is licensed separately.
