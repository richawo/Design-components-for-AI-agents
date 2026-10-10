# design-for-ai

The command line for [Design for AI](https://design.yaps.ai): premium, hand-built React + Tailwind v4 and React Native components, each with a design prompt and a JSON prompt your agent can follow.

```bash
npx https://design.yaps.ai/cli.tgz search sign in        # find components
npx https://design.yaps.ai/cli.tgz add auth-sign-in      # write the file, install missing deps
npx https://design.yaps.ai/cli.tgz prompt auth-sign-in   # print the design brief for your agent
```

No dependencies, Node 18+.

## Commands

| Command | What it does |
| --- | --- |
| `search <query>` | Components matching a query. `--category`, `--tier free\|pro`, `--platform web\|mobile`, `--json` |
| `list` | Every component, grouped by category |
| `info <slug>` | Description, install command and props |
| `add <slug…>` | Writes `components/design-for-ai/<slug>.tsx` (or `src/components/…`, or `--dir`), then installs missing npm dependencies with your package manager. `--force` overwrites, `--no-install` only prints the command |
| `prompt <slug>` | Prints the design brief (`--json` for the JSON prompt). Pipe it to your agent |
| `login <key>` / `logout` | Save or forget a Pro licence key (`~/.config/design-for-ai/config.json`, mode 600) |
| `mcp` | How to connect Claude Code, Cursor, Windsurf and others to the remote MCP server |

## Pro

Pro components need a licence key: `npx https://design.yaps.ai/cli.tgz login dfa_…`, or set `DESIGN_FOR_AI_LICENSE`. Get one at [design.yaps.ai/pricing](https://design.yaps.ai/pricing).

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DESIGN_FOR_AI_LICENSE` | (none) | Pro licence key, overrides `login` |
| `DESIGN_FOR_AI_URL` | `https://design.yaps.ai` | API base, for local development |
| `NO_COLOR` | (unset) | Plain output |

MIT licensed. Pro component source is licensed separately.
