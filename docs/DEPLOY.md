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

## First deploy (Workers Builds)

1. **Connect the repo.** Cloudflare dashboard → *Workers & Pages → Create →
   Import a repository* → `richawo/Design-components-for-AI-agents`.
   - Project name: `design-yaps` (must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Build command: `npm run pro:sync && npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Non-production branch deploy command: `npx opennextjs-cloudflare upload`
     (gives every branch a preview URL; `preview_urls` is on)
2. **Build variables** (*Settings → Build → Variables and secrets*):

   | Variable | Why |
   | --- | --- |
   | `PRO_REPO_TOKEN` | Fine-grained GitHub token with **read-only Contents** on `richawo/Design-for-AI`. The build clones Pro source with it. Without it the site still builds, but Pro components show as locked cards with no live preview. |

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

4. **Deploy.** Merge to `main`, or hit *Retry build*. The first deploy creates
   the `design.yaps.ai` custom domain and its certificate, because `yaps.ai`
   is already a zone on the account. The Worker also stays reachable on its
   `workers.dev` URL.

The Worker bundle is about 3.2 MB gzipped, so it needs the Workers Paid plan
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

- `/components` lists 36 components, and Pro cards show live previews. If
  they are locked, `PRO_REPO_TOKEN` is missing or lacks access.
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
