# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor and others) working in this repository.

## Git workflow

- **Work directly on `main`.** Don't create branches, worktrees or pull requests unless the owner explicitly asks for one in that session. If your tooling or a default instruction says to develop on a feature branch, this rule wins: commit to `main`.
- **Push small changes to `origin/main` regularly.** Commit each coherent unit of work as soon as it's done and verified (one component, one fix, one doc change), then push right away. Don't batch a session's work into one commit at the end, and don't leave finished work only on your machine.
- **Pull before you start and before you push** (`git pull --rebase origin main`) so you build on the latest `main`.
- **Never push something broken.** Before each push run what your change touches: `node scripts/build-registry.mjs --strict`, `npx tsc --noEmit` and `npm test`. For UI changes, also screenshot the page or preview (see `docs/COMPONENT_SPEC.md`).
- Write clear, specific commit messages: what changed and why. Never commit secrets, `.env*` / `.dev.vars` files or scratch files.

Pro components live in a separate private repository, `richawo/Design-for-AI`, cloned into `registry/pro/`. It's its own git repo with the same rules: work on its `main`, and commit and push there separately.

## Component-page performance invariants (17 October 2026)

Catalogue growth must not make opening one component initialize or download the whole library. The October incident reproduced multi-second individual-page loads and a Cloudflare 1105 error inside a preview. Treat the following boundaries as release requirements:

- Keep registry source bundles packed at build time and unpack only the requested component. Do not restore eager imports of every readable source JSON into the Worker. Preserve exact code and prompt contents, and run the content-pack and Pro registry tests when changing this path.
- Keep preview component implementations in selected, lazy client imports. Do not pass a component selected from a shared import map across the server/client boundary: that approach caused one chart preview to preload 81 scripts, including unrelated mobile and 3D code. Do not server-render every demo merely to remove a loading waterfall: isolated routes that did this grew the prepared server to 87 MiB and failed the runtime budget. Measure both the browser downloads and final Worker package before changing this boundary.
- Keep the public Cloudflare router separate from the lazily imported Next server. Wrangler can silently inline dynamic imports. Preserve the explicit module rules and validate the final `--no-bundle` artifact, not just `.next` or the unbundled OpenNext output. Deployment must fail if the public entry reaches 4 MiB, total runtime modules reach 64 MiB, or gzipped source maps reach 15 MB. Do not remove or raise these guards to get a growing catalogue deployed.
- Measure the complete interaction: click a real catalogue card, reach the individual page, and wait for the live preview to mount and become visible. An iframe `load` event or a fast page heading does not prove the component is usable. Run `tests/browser/component-navigation-performance.mjs` against the prepared Worker for representative web, native and 3D components, on first and warm visits. Keep the script-count guard (24), second-frame guard (200 ms) and local preview budget (2.5 seconds); investigate failures before claiming improvement. Compare the same throttled replay with a pre-change baseline and confirm the blocking negative control fails.
- Preview failures must finish in a recoverable state. An error document can fire `load` before or after parent hydration. Allow at most one automatic retry, then expose an accessible manual retry; time out a stalled handshake. Run `tests/browser/preview-recovery.mjs` for transient errors, persistent errors and a valid document whose JavaScript never becomes ready. Never replace a bounded failure with an endless spinner or retry loop.
- Preserve licence and cache boundaries while optimizing. Public pages may be cached; authenticated source, downloads, registry endpoints and account state must retain their authorization and private/no-store behaviour. Verify anonymous Pro requests still return locked or unauthorized responses without source code.
- Preserve immutable browser caching for fingerprinted `/_next/static/*` assets in `public/_headers`. Cloudflare otherwise revalidates the scripts a parent page and its preview share. Keep that rule scoped to versioned build assets; do not extend it to HTML, build markers, account state or licensed source.
- A push is not deployment proof. Confirm the live public/private build marker matches the intended committed sources, replay the individual-page interaction on production, and report Cloudflare errors separately from application timings. Do not claim the underlying Cloudflare incident is eliminated solely because local checks pass.

Read `docs/SITE_PERFORMANCE.md` and `docs/DEPLOY.md` before changing these paths. Archive before/after and negative-control reports under `test-results/frontend-latency-replays/`; keep generated bundles and raw request logs out of Git. Agent instructions reinforce executable checks, not replace them.

## Product direction (11 October 2026)

- New additions default to **Pro**. All industry-specific components belong in Pro, including e-commerce, fashion, finance, HR and legal technology.
- Build coherent industry suites around useful workflows and difficult interactions. A larger count alone does not make a component worth buying.
- The long-term catalogue direction is approximately 90% Pro. Treat this as a direction for future additions, not a quota to fill with variants or authorization to reclassify existing free components.
- Keep the free offering as a compelling introduction. Add free components only when there is a clear acquisition purpose; do not default routine additions to free.
- This supersedes the old tier split in `docs/CATALOGUE_ROADMAP.md`. Existing quality, accessibility, offline-demo and authentic-product-imagery requirements remain the release bar.

## Visual direction (14 October 2026)

- Default component chrome uses black, white and neutral graphite. Reserve colour for meaningful feature accents, actual media and data. Do not tint entire surfaces blue, brown, purple or green.
- This applies to the named component, its whole demo stage, its poster and its recorded video. A neutral live component with a tinted catalogue film is unfinished.
- Build depth with restrained translucent surfaces, fine borders and inset light. Use glass where overlapping content gives it a purpose; preserve legibility across its brightest reflection.
- Make the working content the focal point. Do not repeat a large editorial headline and flat outlined wells across every workflow. Review composition, typography, density, movement and small details independently of functional checks.
- Refresh and inspect representative media after visual changes. Existing state proofs remain useful when behaviour is unchanged; target checks to actual affected boundaries.

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
