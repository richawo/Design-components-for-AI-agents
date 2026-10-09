# Deploying

The site runs on Cloudflare Workers as its own Worker, `design-yaps`, on
`design.yaps.ai`. It follows the same pattern as `launch-yaps` and the other
Yaps subdomains: one Worker per product, a custom-domain route in
`wrangler.jsonc`, and Cloudflare Workers Builds deploying every push to
`main`. It doesn't touch the apex domain or the main `yaps-site` Worker.

Next.js runs on Workers through the [OpenNext adapter](https://opennext.js.org/cloudflare).
Every page is prerendered at build time. Only the licence, checkout, Pro
source and Markdown routes run in the Worker, and none of them read the disk:
`scripts/build-registry.mjs` bundles sources, docs and blog posts into
`registry/__generated__/` so they ship inside the Worker.

## Production status (9 October 2026)

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
Stripe is not configured yet; checkout displays the email fallback.

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
   | `STRIPE_SECRET_KEY` | Checkout. Without it, *Get Pro* asks buyers to email you, and the missing variable is logged. |
   | `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PRO_LIFETIME`, `STRIPE_PRICE_TEAM_YEARLY`, `STRIPE_PRICE_TEAM_LIFETIME` | Stripe price ids (`price_…`) matching `lib/pricing.ts`: $99 a year, $179 once, $299 a year, $499 once. |
   | `LICENSE_REVOKED` | Optional. Comma-separated licence ids to revoke. |

   `NEXT_PUBLIC_SITE_URL` is already set to `https://design.yaps.ai` in
   `wrangler.jsonc`.

4. **Deploy.** Push to `main`, or hit *Retry build*. The first deploy creates
   the `design.yaps.ai` custom domain and its certificate, because `yaps.ai`
   is already a zone on the account. The Worker also stays reachable on its
   `workers.dev` URL.

The Worker bundle is about 4.4 MB gzipped (61 components), so it needs the Workers Paid plan
(10 MB limit), which the Yaps account already uses.

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
- *Get Pro* on `/pricing` opens Stripe Checkout. With a Stripe test key, pay
  with `4242 4242 4242 4242`; you should land on `/account` with a licence key,
  and the Code tab on a Pro component should show source.

## Run the Worker locally

```bash
echo 'LICENSE_SECRET=local-only-secret-at-least-32-chars' > .dev.vars
npm run preview        # OpenNext build, then wrangler dev on workerd
```

Don't symlink `registry/pro` to a checkout elsewhere: Turbopack won't follow
a symlink that leaves the project. Clone the Pro repo into `registry/pro`, or
run `npm run pro:sync`.

## Adapter patch

`scripts/patch-opennext.mjs` runs on `postinstall`. It teaches
`@opennextjs/cloudflare` 1.20.9 to inline `.next/server/preview-props.json`,
which Next 16.4 reads on every request. Without it, every server route on the
Worker returns a 500. Delete the script once the adapter handles the file
itself.
