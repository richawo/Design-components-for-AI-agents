# Deploying

The site runs on Cloudflare Workers as its own Worker, `design-yaps`, on
`design.yaps.ai`. It follows the same pattern as `launch-yaps` and the other
Yaps subdomains: one Worker per product, a custom-domain route in
`wrangler.jsonc`, and Cloudflare Workers Builds configured to deploy pushes to
`main`. Verify the actual live commit marker after a release. It doesn't touch the apex domain or the main `yaps-site` Worker.

Next.js runs on Workers through the [OpenNext adapter](https://opennext.js.org/cloudflare).
Content pages and the generic account loading shell are prerendered at build time. Account data, authentication, billing,
licence, Pro source and Markdown routes run in the Worker. Component and
content routes use bundled data instead of reading the disk:
`scripts/build-registry.mjs` bundles sources, docs and blog posts into
`registry/__generated__/` so they ship inside the Worker.

`open-next.config.ts` publishes the prerendered HTML and React Server Component
payloads through OpenNext's read-only Workers Static Assets cache and enables
cache interception. Public content comes from the build rather than rendering
again during navigation. Dynamic account-data, authentication and licensed-source
routes keep their server authorization checks. Nothing uses runtime revalidation.
See the [OpenNext SSG cache configuration](https://opennext.js.org/cloudflare/caching#ssg-site).
The custom `scripts/deploy-worker.mjs` command runs OpenNext's cache preparation
before Wrangler bundles or uploads, including during a dry run. Without that
step the cache assets are absent and public requests fall back to rendering.

The deployment command also prepares the Node-compatible Next server as a
separate module, then preserves its dynamic import from the small public router.
Keep `find_additional_modules` and the explicit `lazy-modules` rules in
`wrangler.jsonc`. A normal Wrangler rebundle can silently inline that server and
make public cache hits initialize the whole application again. The final upload
uses `--no-bundle`; dry runs use the same preparation and checks. The command
rejects a public entry of 4 MiB or more, runtime modules totalling 64 MiB or more,
and gzipped source maps totalling 15 MB or more. Runtime accounting includes
attached text, SQL and Wasm modules, including nested modules. The generated
server-external public-content package keeps the complete blog/docs payload
in one prepared module instead of duplicating it across Next route chunks.
The final package guard requires exactly one intact copy. This changes neither
article contents nor the Pro source and authorization boundaries. The prepared server
omits the router cache manifest only when the files are identical and the lazy
server does not reference it. Referenced or different modules remain included.

After `npm run deploy:dry-run`, exercise that exact package with
`npx wrangler dev .open-next/deploy/worker.js --no-bundle --port 4189`.
For a large prepared assets directory on macOS, start this local check with
`CHOKIDAR_USEPOLLING=true CHOKIDAR_INTERVAL=1000` if directory watching makes
Wrangler fail with `spawn EBADF`. This avoids the observed watcher-related
startup failure without changing the package or production limits. Keep the
failed observation and verify that the resulting Worker actually serves pages.
Run the component navigation and preview recovery browser replays against it,
and check public cache hits and anonymous Pro-source guards. The faster router
does not authorize caching account state or licensed source.

`public/_headers` gives only fingerprinted `/_next/static/*` files a year of
immutable browser caching. Workers Static Assets otherwise sends
`max-age=0, must-revalidate`, causing a preview to revalidate scripts its parent
already downloaded. HTML, build provenance and authenticated routes retain
their existing policies. See [Cloudflare's static asset header rules](https://developers.cloudflare.com/workers/static-assets/headers/).

Blog Markdown lives in the private repository at `_site/blog/`, cloned into
`registry/pro/_site/blog/`. Its generated bundle is ignored by Git. Production
sync requires these posts as well as the Pro components. A public clone without
private access builds the component library and docs, with blog pages returning
404 and no blog entries in its sitemap.

## Production status (10 October 2026)

The site is live at <https://design.yaps.ai>, with a fallback at
<https://design-yaps.richardawoyemi.workers.dev>. Workers Builds is connected
to `richawo/Design-components-for-AI-agents`, with `main` as the production
branch and all paths watched. Every push syncs Pro source, validates the
registry, checks TypeScript, runs the tests, builds the Worker and deploys it.

The build uses an encrypted `PRO_REPO_SSH_KEY`: a read-only deploy key scoped
to `richawo/Design-for-AI`. It cannot write to either repository. Production
sync uses `--require-source`, so missing credentials or incomplete Pro source
fail the build and leave the previous deployment active. `LICENSE_SECRET`
remains configured separately as a runtime secret.

The source-bound publication build runs the complete test suite with one worker.
This keeps image, source-pack and multilingual checks from competing for build-host
resources. Test coverage, assertions and timeouts remain unchanged.

Email-code accounts, hosted Stripe Checkout, signed billing events, licence
recovery, Team seats and a dedicated billing portal are configured. Commerce
uses its own D1 database, `design-yaps-commerce`, through `COMMERCE_DB`. See
[COMMERCE.md](COMMERCE.md) for the customer flow, event handling, permissions
and test procedure. Automatic tax remains disabled pending confirmed tax
registrations; no active registrations were returned during setup.

## Verified rollout (13 October 2026)

A successful Git push is not proof that production has advanced. On13 October
production was still serving an earlier public/private commit pair. The available
Wrangler credential could deploy the Worker, but Workers Builds status requests
returned403, so automatic build health could not be confirmed.

The verified recovery used immutable archives of pushed public and private
commits, preserving their exact Git identities. It included only Pro components
present in the public committed manifest, kept unrelated local edits outside the
build, and passed strict generation, TypeScript, the Cloudflare build and a Worker
dry run before deployment. The direct deploy command was
`node scripts/deploy-worker.mjs` inside that approved build artifact. No runtime
bindings or commerce migrations changed.

Read `/.well-known/design-build.json` on the actual production domain and compare
both `publicCommit` and `privateContentCommit` with the expected pushed sources.
Also check published component routes and anonymous licence guards. An
unauthenticated Pro-source API response must remain locked and contain no source;
registry installation must return401 with no-store caching. Retain the exact build
provenance and the successful local/production smoke evidence.

## Automatic deploys (Workers Builds)

1. **Connect the repo.** Cloudflare dashboard → *Workers & Pages → design-yaps
   → Settings → Builds → Connect* → `richawo/Design-components-for-AI-agents`.
   - Worker name: `design-yaps` (must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Build command: `npm run pro:sync -- --require-source && npm run blog:audit -- --require-source --require-locales && node scripts/build-registry.mjs --strict && npm run typecheck && npm test && npm run cf:build`
   - Deploy command: `npm run cf:deploy`
   - Build watch paths: include `*`, no exclusions
   - Preview builds: disabled
2. **Build variables** (*Settings → Build → Variables and secrets*):

   | Variable | Why |
   | --- | --- |
   | `NODE_VERSION` | Plain variable, `24.11.1`. Matches the verified Node runtime. |
   | `PRO_REPO_SSH_KEY` | Encrypted secret containing the read-only GitHub deploy key for `richawo/Design-for-AI`. The sync script writes it to a protected temporary file, verifies GitHub against `scripts/github-known-hosts`, then removes the file. |
   | `PRO_REPO_TOKEN` | Optional alternative to the SSH key: a fine-grained token with **read-only Contents** on `richawo/Design-for-AI`. Store it as an encrypted secret. |

   Build credentials are never runtime bindings. Local open-source builds
   may omit Pro source; the production command explicitly requires it.

3. **Runtime secrets** (*Settings → Variables and secrets*, type *Secret*, or
   `npx wrangler secret put <NAME>`):

   | Secret | Why |
   | --- | --- |
   | `LICENSE_SECRET` | Signs and verifies licence keys. 32+ random characters (`openssl rand -base64 48`). Never change it once keys are issued, or every key stops working. |
   | `AUTH_SECRET` | Hashes email codes, sessions, agent (OAuth) tokens and rate-limit identifiers. 32+ random characters. |
   | `STRIPE_SECRET_KEY` | Dedicated restricted key for checkout and billing reads. |
   | `STRIPE_WEBHOOK_SECRET` | Verifies raw events sent to `/api/billing/webhook`. |
   | `RESEND_API_KEY` | Sending-only key restricted to `yaps.ai`, for authentication and licence emails. |
   | `LICENSE_REVOKED` | Optional. Comma-separated licence ids to revoke. |

   Plain variables in `wrangler.jsonc` include `NEXT_PUBLIC_SITE_URL`,
   `EMAIL_FROM`, the four `STRIPE_PRICE_*` IDs, `STRIPE_PORTAL_CONFIGURATION`
   and `STRIPE_AUTOMATIC_TAX`. Prices match `lib/pricing.ts`: $99 a year,
   $179 once, $299 a year and $499 once.

   Apply D1 migrations before code that needs new schema:
   `npx wrangler d1 migrations apply COMMERCE_DB --remote`. Migration
   `0004_mcp_oauth.sql` adds the agent sign-in tables; until it is applied,
   `/mcp/pro` sign-in answers 503 while `/mcp`, keys and accounts keep working.

4. **Deploy.** Push to `main`, or hit *Retry build*. The first deploy creates
   the `design.yaps.ai` custom domain and its certificate, because `yaps.ai`
   is already a zone on the account. The Worker also stays reachable on its
   `workers.dev` URL.

The deployment uses the Yaps account's existing Workers Paid plan. Verify
the upload size during a dry run as the component library grows.

## Deploy from a terminal

```bash
npx wrangler login
PRO_REPO_TOKEN=… npm run deploy   # pro:sync, OpenNext build, deploy
npm run deploy:dry-run            # build and bundle without uploading
```

## After a Pro change

Pro source lives in `richawo/Design-for-AI`. Pushing there doesn't rebuild
this Worker. Either hit *Retry build* on the latest deployment, or create a
[Deploy Hook](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/)
and use the manual fallback workflow in the Pro repo. Normal editorial batches
use the source-bound public publication signal described in `docs/BLOG.md`,
which triggers the existing Cloudflare integration without an Actions job.

When that signal is present, Pro sync fetches its exact `privateContentCommit`
and checks out that immutable source in the fresh build clone. It must not use
the latest private `main`, which may contain later unapproved edits. An existing
checkout must be clean and already match the requested commit. Sync refuses to
move a developer's branch or overwrite local work; use a fresh build checkout
when verifying another pinned publication.

### Private visual-style source

`registry/style-source.json` independently pins the three private Crayon material
files by Git commit and SHA-256. Pro sync fetches that commit and materializes only
those blobs under ignored `registry/__generated__/style-inputs/`. It does not move
the editorial checkout or include later blog edits. Changing a style requires a
reviewed private commit followed by a new public pin. The generator rejects a
hash mismatch before building styled component packs.

The live marker also reports `visualStyleSource.commit`, `pinSha256` and
`available`. Production must match the public pin and report `available: true`.
A public clone without private credentials can still build with locked styles.
Styled packs stay server-only and lazy. Preview material, code, prompts and
`/r/styles/crayon/*.json` all require a live Pro entitlement and use private,
no-store responses, including when the original component is free. Discovery
metadata and selector labels remain public.

## Check a deployment

- `/components` lists the published components, free and Pro. Each card shows its
  poster, and cards with a demo recording play it, muted and looping, while they
  are in view (posters only with reduced motion or Save-Data). The headline shows
  the real count in the server HTML. A Pro component's page renders its live
  preview; if that is locked in a manual build, Pro source was not synced. The
  automatic production build rejects this condition.
- `/api/registry` returns JSON, and `/r/chart-portfolio.json` returns a shadcn
  registry item whose URLs use `https://design.yaps.ai`.
- `/components/chart-candlestick.md` returns Markdown, and
  `/api/registry/chart-candlestick` returns 401 without a licence.
- *Get Pro* on `/pricing` sends a signed-out visitor to email sign-in, then
  offers Stripe Checkout. Use a separate sandbox and local commerce database
  for test-card purchases. Verify the webhook, account key, Pro downloads,
  billing portal, full test refund and recovery after sign-out. Never use a
  test card with the production live key. See [COMMERCE.md](COMMERCE.md).

## Run the Worker locally

```bash
# Put local-only LICENSE_SECRET and AUTH_SECRET (32+ chars each) in .dev.vars.
npx wrangler d1 migrations apply COMMERCE_DB --local
npm run preview        # OpenNext build, then wrangler dev on workerd
```

Don't symlink `registry/pro` to a checkout elsewhere: Turbopack won't follow
a symlink that leaves the project. Clone the Pro repo into `registry/pro`, or
run `npm run pro:sync`.

## CLI distribution

`prebuild` packages the zero-dependency public CLI into `public/cli.tgz`
and the stdio MCP wrapper into `public/mcp.tgz`.
The archives contain only their public entry points, package metadata and
documentation. An allowlist rejects unexpected files.
Buyers can run `npx https://design.yaps.ai/cli.tgz` without waiting for npm
publication. The generated archive stays out of Git and is rebuilt by Workers
Builds.

## Adapter patch

`scripts/patch-opennext.mjs` runs on `postinstall`. It teaches
`@opennextjs/cloudflare` 1.20.9 to inline `.next/server/preview-props.json`,
which Next 16.4 reads on every request. Without it, every server route on the
Worker returns a 500. Delete the script once the adapter handles the file
itself.
