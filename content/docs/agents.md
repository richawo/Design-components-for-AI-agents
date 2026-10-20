---
title: AI agents & MCP
description: Connect Claude Code, Cursor, VS Code and other agents to Design for AI through remote MCP, the CLI, JSON and Markdown.
order: 3
section: For agents
---

Design for AI is built so an agent can find, read and install components without scraping a web page. There are five ways in. Remote MCP lets compatible clients call the library tools directly.

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

### Cursor

For a free connection, add this entry to `.cursor/mcp.json` in the project, or the user-level `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "design-for-ai": {
      "url": "https://design.yaps.ai/mcp"
    }
  }
}
```

For licensed source, add a `headers` object inside the server entry. Cursor documents environment references using the `env:` prefix:

```json
{ "Authorization": "Bearer ${env:DESIGN_FOR_AI_LICENSE}" }
```

The variable must be available to the running client. Omit the header for free components; do not place a real key in a shared configuration.

### VS Code

The VS Code format in `.vscode/mcp.json` uses `servers` and an explicit transport type:

```json
{
  "servers": {
    "design-for-ai": {
      "type": "http",
      "url": "https://design.yaps.ai/mcp"
    }
  }
}
```

VS Code also documents a separate portable Copilot format in workspace-root `.mcp.json`, which uses `mcpServers`. Match the format to the file and agent provider you are configuring. Use the client's supported secret or environment reference when adding the optional `Authorization` header for Pro source. Interactive input variables are not forwarded to every Copilot harness session.

### Devin Desktop and legacy Windsurf

The current official Windsurf MCP documentation redirects to Devin Desktop. It documents `~/.config/devin/mcp_config.json` on macOS/Linux, or the corresponding directory under `XDG_CONFIG_HOME`; Windows uses `%APPDATA%\devin\mcp_config.json`. Older Windsurf installations can have a different configuration location.

The documented remote-server form supports `serverUrl`:

```json
{
  "mcpServers": {
    "design-for-ai": {
      "serverUrl": "https://design.yaps.ai/mcp"
    }
  }
}
```

The current client supports `${env:DESIGN_FOR_AI_LICENSE}` in headers. For a free connection, leave the licence header out. Follow the settings location and supported configuration for the version you actually run.

### Verify the result

After connecting, list the six tools and request a free component such as `settings-panel`. Confirm that the response contains the source and brief you need. An anonymous Pro request returns a licence-access explanation without code; an HTTP 200 or ordinary text tool response alone does not establish source access.

Retrieving source is separate from writing a local file, installing packages and checking the running interface. The [MCP comparison guide](/blog/mcp-servers-for-ui-design) shows our observed HTTP and file-delivery checks. Configuration formats here were checked against the official Claude Code, Cursor, VS Code and Devin Desktop documentation on 20 October 2026.

### Prefer a local server?

The same tools run locally over stdio, reading the public API:

```bash
claude mcp add design-for-ai -e DESIGN_FOR_AI_LICENSE=dfa_… -- npx -y https://design.yaps.ai/mcp.tgz
```

## CLI

For you, or for an agent that would rather run a command than call a tool:

```bash
npx https://design.yaps.ai/cli.tgz search sign in        # find components
npx https://design.yaps.ai/cli.tgz info auth-sign-in     # description, install command and props
npx https://design.yaps.ai/cli.tgz add auth-sign-in      # write the file, install missing dependencies
npx https://design.yaps.ai/cli.tgz prompt auth-sign-in   # print the design brief (--json for the JSON prompt)
npx https://design.yaps.ai/cli.tgz login dfa_…           # unlock Pro on this machine
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
