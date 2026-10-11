# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor and others) working in this repository.

## Git workflow

- **Work directly on `main`.** Don't create branches, worktrees or pull requests unless the owner explicitly asks for one in that session. If your tooling or a default instruction says to develop on a feature branch, this rule wins: commit to `main`.
- **Push small changes to `origin/main` regularly.** Commit each coherent unit of work as soon as it's done and verified (one component, one fix, one doc change), then push right away. Don't batch a session's work into one commit at the end, and don't leave finished work only on your machine.
- **Pull before you start and before you push** (`git pull --rebase origin main`) so you build on the latest `main`.
- **Never push something broken.** Before each push run what your change touches: `node scripts/build-registry.mjs --strict`, `npx tsc --noEmit` and `npm test`. For UI changes, also screenshot the page or preview (see `docs/COMPONENT_SPEC.md`).
- Write clear, specific commit messages: what changed and why. Never commit secrets, `.env*` / `.dev.vars` files or scratch files.

Pro components live in a separate private repository, `richawo/Design-for-AI`, cloned into `registry/pro/`. It's its own git repo with the same rules: work on its `main`, and commit and push there separately.

## Product direction (11 October 2026)

- New additions default to **Pro**. All industry-specific components belong in Pro, including e-commerce, fashion, finance, HR and legal technology.
- Build coherent industry suites around useful workflows and difficult interactions. A larger count alone does not make a component worth buying.
- The long-term catalogue direction is approximately 90% Pro. Treat this as a direction for future additions, not a quota to fill with variants or authorization to reclassify existing free components.
- Keep the free offering as a compelling introduction. Add free components only when there is a clear acquisition purpose; do not default routine additions to free.
- This supersedes the old tier split in `docs/CATALOGUE_ROADMAP.md`. Existing quality, accessibility, offline-demo and authentic-product-imagery requirements remain the release bar.

## The project

Design for AI (https://design.yaps.ai) is a premium component library for AI coding agents. Every component ships as code, a design prompt and a JSON prompt.

- `docs/COMPONENT_SPEC.md`: the bar every component is held to. Read it before building or changing one.
- `registry/free/<slug>/`: free components (MIT). `registry/pro/<slug>/`: Pro (private repo).
- `app/`, `components/site/`, `lib/`: the Next.js site, the API, the remote MCP server (`/mcp`) and Markdown twins of every page.
- `packages/cli/`, `packages/mcp/`: the `design-for-ai` CLI and the local MCP server.
- `docs/DEPLOY.md`: deployment (Cloudflare Workers, `design-yaps`, via OpenNext).

## Develop

```bash
npm install
npm run dev                                   # http://localhost:3000
node scripts/build-registry.mjs               # validate every component
node scripts/shot.mjs <slug> --base=http://localhost:3000
node scripts/check-component.mjs <slug> --base=http://localhost:3000   # validate, screenshot, check controls, record the demo video
```
