# Deploying

The site is a standard Next.js app and deploys to Vercel with no code changes.
`vercel.json` sets the build to `npm run pro:sync && npm run build`, so Pro
source is pulled in at build time and never committed to this public repo.

## First deploy (about ten minutes)

1. **Import the repo.** On vercel.com: *Add New → Project → Import*
   `richawo/Design-components-for-AI-agents`. Leave the framework preset as
   Next.js and the root directory as `/`.
2. **Add environment variables** (*Settings → Environment Variables*,
   Production and Preview):

   | Variable | Needed for | Notes |
   | --- | --- | --- |
   | `PRO_REPO_TOKEN` | Pro previews, Pro source and the gated registry | Fine-grained GitHub token, **read-only Contents** on `richawo/Design-for-AI`. Without it the site still builds, and Pro components show as locked cards. |
   | `LICENSE_SECRET` | Issuing and checking licence keys | 32+ random characters (`openssl rand -base64 48`). Never change it once keys have been issued, or every key stops working. |
   | `STRIPE_SECRET_KEY` | Checkout | Without it, *Get Pro* shows “Checkout isn't configured yet”. |
   | `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PRO_LIFETIME`, `STRIPE_PRICE_TEAM_YEARLY`, `STRIPE_PRICE_TEAM_LIFETIME` | Checkout | Stripe price ids (`price_…`) matching `lib/pricing.ts`: $99 a year, $179 once, $299 a year, $499 once. |
   | `NEXT_PUBLIC_SITE_URL` | Canonical URLs, install commands, registry items | Set it once the custom domain is live, e.g. `https://design.yaps.ai`. Until then the deployment's own `*.vercel.app` production URL is used. |
   | `LICENSE_REVOKED` | Optional | Comma-separated licence ids to revoke. |

3. **Deploy.** Every push to `main` deploys to production; every other branch
   gets a preview URL.
4. **Attach the domain** (*Settings → Domains*), add `NEXT_PUBLIC_SITE_URL`,
   and redeploy so canonical URLs and `npx shadcn add …` commands point at it.

## After a Pro change

Pro source lives in `richawo/Design-for-AI`. Pushing there doesn't trigger a
deploy of this repo. Either redeploy from the Vercel dashboard, or add a
[Deploy Hook](https://vercel.com/docs/deploy-hooks) and call it from a GitHub
Action in the Pro repo.

## Check a deployment

- `/components` lists 36 components, and Pro cards show live previews (if they
  are locked, `PRO_REPO_TOKEN` is missing or lacks access).
- `/api/registry` returns JSON, and `/r/chart-portfolio.json` returns a shadcn
  registry item whose URLs use the right domain.
- *Get Pro* on `/pricing` opens Stripe Checkout. With a Stripe test key, pay
  with `4242 4242 4242 4242`; you should land on `/account` with a licence key.
- On a Pro component page, the Code tab now shows source.

## Local production check

```bash
npm ci
PRO_REPO_TOKEN=… npm run pro:sync      # or: git clone <Pro repo> registry/pro
npm run build && npm start
```

Don't symlink `registry/pro` to a checkout elsewhere: Turbopack won't follow
a symlink that leaves the project, and the Pro previews fail to compile.
