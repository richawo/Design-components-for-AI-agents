---
title: AI agents & MCP
description: Connect Claude Code, Claude, ChatGPT, Cursor, VS Code, Codex and other agents to Design for AI through remote MCP with browser sign-in, the CLI, JSON and Markdown.
order: 3
section: For agents
---

Design for AI is built so an agent can find, read and install components without scraping a web page. There are five ways in. Remote MCP lets compatible clients call the library tools directly.

## MCP server (remote)

The site itself is an MCP server. Nothing to install or keep up to date. It has two addresses:

| Address | Use it for |
| --- | --- |
| `https://design.yaps.ai/mcp/pro` | **Recommended.** Your agent signs in through your browser, so there's no key to copy into a config file. Pro components unlock when your account has a licence; otherwise you get every free component. |
| `https://design.yaps.ai/mcp` | Free components with no sign-in. Also accepts a licence key header, for machines without a browser. |

Both speak Streamable HTTP and give your agent six tools:

| Tool | What it does |
| --- | --- |
| `search_components` | Search by keyword, category, tier or platform |
| `get_component` | Code, design prompt, JSON prompt, props and install command for one component |
| `list_categories` | Every category with counts |
| `get_principles` | The anti-slop design principles, to use as a system prompt |
| `install_command` | The exact command to add a component to the current project |
| `get_page` | Any page of this site as Markdown (pricing, docs, a category) |

Signing in uses the MCP authorization standard (OAuth 2.1 with PKCE). Your agent opens a page on this site; you sign in with your email code and approve. Each agent gets its own access, which you can see and disconnect on [your account page](/account). Upgrades and renewals apply to connected agents automatically.

### Crayon visual style

Crayon gives components a paper palette, hand-drawn headings and irregular edges while keeping their props and interactions. React Native downloads retain native views, gestures and platform font fallbacks. Everyone can discover the style. Selecting it, downloading its code and retrieving its design prompts requires Pro, including when the original component is free.

Ask your agent: “Find a pricing component in the Crayon style and add it to my project.” The same optional `visualStyle` parameter works on the remote and local MCP servers:

```json
{"name":"search_components","arguments":{"query":"pricing","visualStyle":"crayon"}}
```

Use a slug from those results:

```json
{"name":"get_component","arguments":{"slug":"pricing-three-tier","visualStyle":"crayon"}}
```

`install_command` accepts the same parameter. Omitting it returns the original design. Available styles are listed on every result. Your existing Pro sign-in or licence key unlocks the style without another credential.

### Claude Code

```bash
claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp/pro
```

Then run `/mcp` in Claude Code, choose `design-for-ai` and select Authenticate. Approve in the browser window that opens.

### Claude (web and desktop)

Open Settings, then Connectors, and select Add custom connector. Name it Design for AI, paste `https://design.yaps.ai/mcp/pro`, then select Connect and approve in the browser. On Team and Enterprise plans an owner adds the connector for the organization first.

### ChatGPT

In ChatGPT settings, open Apps and Connectors, then Advanced settings, and turn on Developer mode. Create a connector with the URL `https://design.yaps.ai/mcp/pro` and OAuth authentication, then approve in the browser. ChatGPT can't send a licence key header, so signing in is how it gets Pro. Menu names change between plans and releases; follow the current labels if they differ.

### Cursor

Use **Add to Cursor** at the top of this page, or add this entry to `~/.cursor/mcp.json` (or the project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "design-for-ai": {
      "url": "https://design.yaps.ai/mcp/pro"
    }
  }
}
```

Cursor shows the server as needing login. Select it and approve in the browser.

### VS Code

Use **Add to VS Code** at the top of this page, or add this to `.vscode/mcp.json`:

```json
{
  "servers": {
    "design-for-ai": {
      "type": "http",
      "url": "https://design.yaps.ai/mcp/pro"
    }
  }
}
```

Start the server when VS Code asks, allow it to sign in, and approve in the browser.

### Codex

```bash
codex mcp add design-for-ai --url https://design.yaps.ai/mcp/pro
codex mcp login design-for-ai
```

`codex mcp login` opens the browser to approve.

### Any other agent

Paste this into a coding agent that can change its own settings. It contains no secret:

```text
Connect the Design for AI MCP server to this agent. Add a remote (Streamable HTTP) MCP server named design-for-ai with the URL https://design.yaps.ai/mcp/pro, using this tool's own MCP command or configuration file. It signs me in through my browser with OAuth, so don't add an API key or Authorization header. Then start the sign-in (for example /mcp in Claude Code, or codex mcp login design-for-ai in Codex), and confirm the design-for-ai tools are available.
```

Any MCP client that supports OAuth can use `https://design.yaps.ai/mcp/pro` directly. Devin Desktop and Windsurf use `serverUrl` in `mcp_config.json`; if your version doesn't offer sign-in, use the licence key route below.

### With a licence key instead

For CI, remote machines and clients without browser sign-in, send your key to `https://design.yaps.ai/mcp`. Your [account page](/account) shows these commands with your key already filled in.

```bash
claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp \
  --header "Authorization: Bearer $DESIGN_FOR_AI_LICENSE"
```

In Cursor, add `"headers": { "Authorization": "Bearer ${env:DESIGN_FOR_AI_LICENSE}" }` inside the server entry. VS Code and Devin Desktop support their own secret or environment references in headers. Never put a real key in a shared configuration.

If the key doesn't arrive intact, the server says why instead of quietly serving free components: an empty header (the variable wasn't set when the server was added), a variable name the client didn't expand, or a key that is expired, revoked or invalid.

### Verify the result

After connecting, list the six tools and request a free component such as `settings-panel`. Confirm that the response contains the source and brief you need. The `initialize` response says whether a Pro licence is active for the connection. An anonymous Pro request returns a licence-access explanation without code; an HTTP 200 or ordinary text tool response alone does not establish source access.

Retrieving source is separate from writing a local file, installing packages and checking the running interface. The [MCP comparison guide](/blog/mcp-servers-for-ui-design) shows our observed HTTP and file-delivery checks. Key-based configuration formats were checked against the official Claude Code, Cursor, VS Code and Devin Desktop documentation on 20 October 2026.

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
