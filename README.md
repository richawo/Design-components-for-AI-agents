<div align="center">

# Design components for AI agents

**Precise, responsive React, Tailwind and React Native components, each shipped with the code, a design prompt and a JSON prompt, so the interfaces your AI agent builds look designed, not generated.**

[Browse the library](https://design.yaps.ai/components) · [Docs](https://design.yaps.ai/docs) · [MCP server](https://design.yaps.ai/docs/agents) · [Design principles](https://design.yaps.ai/docs/principles) · [Pricing](https://design.yaps.ai/pricing)

</div>

---

AI coding agents are excellent engineers and average designers. Left to their defaults, Claude Code, Cursor, v0, Lovable and Bolt all reach for the same purple gradients, sparkle badges and three identical feature cards: the look people now call *AI slop*.

**Design for AI** gives your agent something specific to work from. Every component is a single self-contained file plus two briefs that describe exactly how it's designed:

| Format | What it is | Use it when |
| --- | --- | --- |
| **Code** | One `.tsx` file. React 19 + Tailwind CSS v4 (+ `motion` or `three` where needed), or React Native core APIs only. | You want it in your project now. |
| **Prompt** | A design director's brief: type scale, colour, spacing, motion, accessibility and a list of what to avoid. | You want your agent to rebuild it in your brand or stack. |
| **JSON prompt** | The same brief as structured data with stable keys. | You're scripting, swapping one dimension at a time, or your agent follows specs better than prose. |

## What's inside

- **Charts & data:** financial-grade charts with crosshairs, range morphing, volume and keyboard inspection. Hand-drawn SVG, no chart library.
- **3D & WebGL:** Three.js scenes (particle fields, shader-lit objects) that stay tasteful, responsive and cheap to run.
- **Pixel & generative:** dot-matrix displays, pixel animation and generative textures.
- **AI interfaces:** chat threads, streaming text, command palettes, agent timelines.
- **Marketing sections:** heroes, pricing, features, social proof, calls to action, navigation.
- **App UI and forms:** dashboards, tables, settings, sign-in, one-time codes.
- **React Native:** onboarding, tab bars, bottom sheets, paywalls, chat, wallets and swipe lists, previewed live on the web through react-native-web.

Every component is responsive (to its container, not just the viewport), keyboard accessible and respects `prefers-reduced-motion`.

## Quick start

### shadcn CLI

```bash
npx shadcn@latest add https://design.yaps.ai/r/chart-portfolio.json
```

### MCP server (Claude Code, Cursor, Windsurf, VS Code)

The site is a remote MCP server; nothing to install:

```bash
claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp
```

Then ask: *"Find a Design for AI chart component and add it to the dashboard."* Prefer a local process? `npx -y design-for-ai-mcp`.

### CLI

```bash
npx design-for-ai search sign in
npx design-for-ai add auth-sign-in      # writes the file, installs its dependencies
npx design-for-ai prompt auth-sign-in   # the design brief, for your agent
```

### Claude skill

Copy [`skills/design-for-ai`](skills/design-for-ai) into `.claude/skills/` (one project) or `~/.claude/skills/` (every project). It teaches your agent when to reach for a component, how to adapt one without flattening it, and the checklist to run before it says it's done.

### Paste the brief

Open any component page, hit **Copy for agent**, and paste it into your chat. You get the install command, the design brief and the source in one message.

### For language models

- Every page has a Markdown twin: add `.md` to any URL ([`/index.md`](https://design.yaps.ai/index.md), [`/pricing.md`](https://design.yaps.ai/pricing.md))
- [`/llms.txt`](https://design.yaps.ai/llms.txt): a map of the library
- [`/llms-full.txt`](https://design.yaps.ai/llms-full.txt): every free component's prompt and JSON prompt
- [`/api/registry`](https://design.yaps.ai/api/registry): a JSON index of everything

## Repository layout

```
app/                    Next.js site (App Router): gallery, docs, blog, API, SEO routes
components/site/        Site chrome, never shipped to users
registry/free/<slug>/   Free components: <slug>.tsx, meta.json, prompt.md, prompt.json (MIT)
registry/pro/           Pro components, cloned from a private repo at build time (gitignored)
registry/pro-manifest.json   Public metadata for Pro components
content/                Docs and blog posts (Markdown)
scripts/                Registry build, screenshots, Pro sync
packages/mcp/           design-for-ai-mcp, the local (stdio) MCP server
packages/cli/           design-for-ai, the CLI
lib/mcp.ts, app/mcp/    the remote MCP server at /mcp
skills/design-for-ai/   Claude skill: find, adapt and review against the principles
docs/COMPONENT_SPEC.md  The bar every component is held to
```

## Develop

```bash
npm install
npm run dev                                   # http://localhost:3000
node scripts/build-registry.mjs               # validate every component
node scripts/shot.mjs <slug> --base=http://localhost:3000   # screenshots at 1440/768/390
```

Production runs on Cloudflare Workers (`design-yaps`, on `design.yaps.ai`) via OpenNext; see [`docs/DEPLOY.md`](docs/DEPLOY.md). `npm run preview` runs the built Worker locally.

The site builds without the Pro source: Pro components render as locked cards using `registry/pro-manifest.json`. With access to the private repo, `npm run pro:sync` (needs `PRO_REPO_TOKEN`) clones it into `registry/pro/`.

## Contributing

New free components are welcome, and the bar is high on purpose. Read [`docs/COMPONENT_SPEC.md`](docs/COMPONENT_SPEC.md), build your component in `registry/free/<slug>/`, run the screenshot loop until it holds up at every width, and open a PR.

## Licence

Free components, the site and the tooling are [MIT](LICENSE). Pro components are licensed separately; see [design.yaps.ai/docs/license](https://design.yaps.ai/docs/license).

<sub>Design for AI is a [Yaps](https://www.yaps.ai) project.</sub>
