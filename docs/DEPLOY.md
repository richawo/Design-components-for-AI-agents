# Deploying

The site runs on Cloudflare Workers as its own Worker, `design-yaps`, on
`design.yaps.ai`. It follows the same pattern as `launch-yaps` and the other
Yaps subdomains: one Worker per product, a custom-domain route in
`wrangler.jsonc`, and Cloudflare Workers Builds deploying every push to
`main`. It doesn't touch the apex domain or the main `yaps-site` Worker.

Next.js runs on Workers through the [OpenNext adapter](https://opennext.js.org/cloudflare).
Content pages are prerendered at build time. Account, authentication, billing,
licence, Pro source and Markdown routes run in the Worker. Component and
content routes use bundled data instead of reading the disk:
`scripts/build-registry.mjs` bundles sources, docs and blog posts into
`registry/__generated__/` so they ship inside the Worker.

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

Email-code accounts, hosted Stripe Checkout, signed billing events, licence
recovery, Team seats and a dedicated billing portal are configured. Commerce
uses its own D1 database, `design-yaps-commerce`, through `COMMERCE_DB`. See
[COMMERCE.md](COMMERCE.md) for the customer flow, event handling, permissions
and test procedure. Automatic tax remains disabled pending confirmed tax
registrations; no active registrations were returned during setup.

## Automatic deploys (Workers Builds)

1. **Connect the repo.** Cloudflare dashboard → *Workers & Pages → design-yaps
   → Settings → Builds → Connect* → `richawo/Design-components-for-AI-agents`.
   - Worker name: `design-yaps` (must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Build command: `npm run pro:sync -- --require-source && node scripts/build-registry.mjs --strict && npm run typecheck && npm test && npm run cf:build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
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
   | `AUTH_SECRET` | Hashes email codes, sessions and rate-limit identifiers. 32+ random characters. |
   | `STRIPE_SECRET_KEY` | Dedicated restricted key for checkout and billing reads. |
   | `STRIPE_WEBHOOK_SECRET` | Verifies raw events sent to `/api/billing/webhook`. |
   | `RESEND_API_KEY` | Sending-only key restricted to `yaps.ai`, for authentication and licence emails. |
   | `LICENSE_REVOKED` | Optional. Comma-separated licence ids to revoke. |

   Plain variables in `wrangler.jsonc` include `NEXT_PUBLIC_SITE_URL`,
   `EMAIL_FROM`, the four `STRIPE_PRICE_*` IDs, `STRIPE_PORTAL_CONFIGURATION`
   and `STRIPE_AUTOMATIC_TAX`. Prices match `lib/pricing.ts`: $99 a year,
   $179 once, $299 a year and $499 once.

   Apply D1 migrations before code that needs new schema:
   `npx wrangler d1 migrations apply COMMERCE_DB --remote`.

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
and call it from a GitHub Action in the Pro repo.

## Check a deployment

- `/components` lists the published components, and Pro cards show live previews. If
  they are locked in a manual build, Pro source was not synced. The automatic
  production build rejects this condition.
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
