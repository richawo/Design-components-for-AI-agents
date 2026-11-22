# Funnel analytics

Updated 22 November 2026. The site tracks the whole visitor journey: which
pages people land on (blog, components, pricing), how long they stay, where
they click next, where they leave, and whether they sign in, start Checkout and
pay. Use it to see where people drop off.

## How it works

```
browser (lib/analytics/client.ts, components/site/site-analytics.tsx)
   │  batched POST /_dfa/e  (sendBeacon on hide/leave)
   ▼
public router: proxy.ts → lib/analytics/collector.ts     ← never loads the Next server
   │  validates, drops bots and unknown events, adds country/region/city
   ▼
lib/analytics/sink.ts ──► Workers Analytics Engine (dataset design_yaps_funnel, always on)
                     └──► Mixpanel /track (when the MIXPANEL_TOKEN secret is set)

commerce routes and the Stripe webhook (lib/analytics/server.ts)
   └── checkout_session_created, purchase_completed, checkout_session_expired
```

- **First-party collection.** Events go to this site's own `/_dfa/e`, not to
  a third-party script. No SDK is loaded and nothing is added to the
  component pages' script budget. Ad blockers that block `mixpanel.com` don't
  block the funnel.
- **Router-level collector.** OpenNext runs `proxy.ts` inside the small public
  Worker entry. The collector returns its own response there, so the lazily
  imported Next server is never loaded for analytics (see the performance
  invariants in `AGENTS.md`).
- **Server-confirmed conversions.** Revenue comes from the Stripe webhook,
  not the browser, so blockers, closed tabs and failed redirects can't lose
  a sale.

## Identity and privacy

| Field | Source | Notes |
| --- | --- | --- |
| `$device_id` | random UUID in `localStorage` (`dfa.did`) | anonymous, per browser |
| `session_id` | `localStorage` (`dfa.ses`) | new after 30 minutes idle or a new UTM campaign |
| `$user_id` | internal account id (a UUID) | set after sign-in or account load; cleared on sign-out |

Mixpanel's Simplified ID Merge joins the anonymous journey to the account when
an event carries both `$device_id` and `$user_id`. Checkout requests send the
device id in the `x-dfa-device` header, so the server's
`checkout_session_created` event joins the same journey.

The site never sends an email address, IP address, search text, form contents,
licence key or Stripe identifier. Location comes from Cloudflare's coarse edge
data (`mp_country_code`, `$region`, `$city`), and Mixpanel is called with
`ip=0`. Tracking turns off for Global Privacy Control, Do Not Track, automated
browsers (`navigator.webdriver`) and framed previews. To test locally in an
automated browser, set `localStorage["dfa.debug"] = "1"`. Every event is then
also logged to the console, and `next dev` prints received batches.

**Consent.** The tracker stores a first-party identifier without asking. In
the UK and EU, PECR and the ePrivacy Directive generally require consent for
non-essential analytics storage. Before relying on this data commercially,
decide whether to add a consent prompt. `analyticsEnabled()` in
`lib/analytics/client.ts` is the single switch to gate.

## Event dictionary

Every browser event also carries: `path`, `$current_url`, `page_type`, `slug`,
`locale`, `session_page_index`, `landing_page_type`, `$referring_domain`
(session), `utm_*` (session), `initial_referring_domain`,
`initial_landing_page_type`, `initial_utm_source`, `initial_utm_campaign`,
`$screen_width`, `viewport_width`, the kept query parameters (`q_plan`,
`q_tier`, `q_cancelled`, `q_welcome`, `q_pending`, `q_category`, `q_ref`),
`$browser`, `$os`, `device_type` and location.

`page_type` is one of `home`, `blog_index`, `blog_category`, `blog_post`,
`pricing`, `components_index`, `component`, `blocks_index`, `block`,
`category`, `docs`, `account`, `oauth`, `file` or `other`.

| Event | When | Extra properties |
| --- | --- | --- |
| `page_view` | each page, including client-side navigation | `previous_path` |
| `page_engagement` | page hidden, closed or navigated away from | `engaged_ms` (since the last report; sum it), `total_engaged_ms`, `max_scroll_pct` |
| `content_engaged` | 10 s of visible time on a page (once per page) | `engaged_ms`, `max_scroll_pct` |
| `blog_read_progress` | blog post scrolled past 25/50/75/90% | `depth` |
| `link_clicked` | any link click | `target`, `target_page_type` (`outbound` for other sites), `outbound`, `label`, `section` (`header`, `footer`, `nav`, `main` or a `data-track-section` value) |
| `copied` | a copy button succeeded (install commands, prompts, code) | `label`, `chars`, `command` |
| `plan_cadence_changed` | pricing toggle | `cadence` |
| `checkout_clicked` | a buy button (pricing or account) | `plan`, `cadence`, `price`, `surface` |
| `checkout_redirected` | sent to Stripe or to sign in first | `plan`, `destination` (`stripe` / `sign_in`), `surface` |
| `checkout_error` | Checkout could not start | `plan`, `status`, `error`, `surface` |
| `checkout_cancelled` | returned from Stripe with `?cancelled=1` | |
| `sign_in_code_requested` | email code sent | `resend` |
| `sign_in_failed` | code request or verification failed | `stage`, `status` |
| `signed_in` | code verified | `method` |
| `account_loaded` | account page resolved its state | `state` (`signed-in`, `signed-out`, `key`), `has_active_licence`, `plan`, `welcome`, `pending` |
| `purchase_confirmed` | the account page shows the new active licence after Checkout | `plan` |
| `licence_key_activated`, `billing_portal_opened`, `signed_out` | account actions | `plan` where known |
| `checkout_session_created` *(server)* | Stripe Checkout session issued | `plan`, `price`, `mode` |
| `purchase_completed` *(server)* | webhook created an active licence (once per Checkout session) | `plan`, `mode`, `seats`, `revenue` (USD after discounts), `currency`, `discounted` |
| `checkout_session_expired` *(server)* | Checkout abandoned at Stripe or async payment failed | `plan`, `reason` |

Adding an event: add it to `CLIENT_EVENTS` (or `SERVER_EVENTS`) in
`lib/analytics/events.ts`, call `track()` / `trackServer()`, and document it
here. The collector drops names it doesn't know.

## Funnels to build in Mixpanel

1. **Content to purchase:** `page_view` (page_type = blog_post) → `page_view` (pricing) → `checkout_clicked` → `checkout_session_created` → `purchase_completed`.
2. **Pricing drop-off:** `page_view` (pricing) → `checkout_clicked` → `checkout_redirected` → `checkout_session_created` → `purchase_completed`. Break down by `plan` and `$referring_domain`.
3. **Sign-in friction:** `checkout_redirected` (destination = sign_in) → `sign_in_code_requested` → `signed_in` → `checkout_session_created`.
4. **Catalogue intent:** `page_view` (component) → `copied` → `page_view` (pricing).
5. **Bounce:** sessions whose only event is one `page_view` (or, in Mixpanel, users with `page_view` but no `content_engaged` and no second `page_view` within the session). Break down by `landing_page_type` and `utm_source`.
6. **Abandoned Checkout:** `checkout_session_created` → not `purchase_completed` (or `checkout_session_expired`).

## Setup

1. Create a Mixpanel project. The default host is the EU residency endpoint, to
   match the other Yaps projects. For a US project, set `MIXPANEL_API_HOST` in
   `wrangler.jsonc` to `https://api.mixpanel.com`.
2. Add the project token as a Worker secret:

   ```bash
   npx wrangler secret put MIXPANEL_TOKEN
   ```

3. Deploy. Analytics Engine needs no setup: the `FUNNEL_EVENTS` binding
   creates `design_yaps_funnel` on first write. Analytics Engine records
   events even before a Mixpanel token exists.
4. Check delivery in Mixpanel → Events (live view), or with the SQL below.
   Worker logs report failed Mixpanel deliveries as
   `analytics: mixpanel rejected events`.

## Analytics Engine SQL

Query with the [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/)
(an API token with *Account Analytics: Read*). Columns are positional; see
`dataPoint()` in `lib/analytics/sink.ts`:

| Column | Field | Column | Field |
| --- | --- | --- | --- |
| blob1 | event | blob11 | country |
| blob2 | page_type | blob12 | locale |
| blob3 | path | blob13 | plan |
| blob4 | device_id | blob14 | slug |
| blob5 | session_id | blob15 | target / error |
| blob6 | user_id | blob16 | device_type |
| blob7 | session referrer domain | blob17 | source (`web` / `server`) |
| blob8–10 | utm_source / medium / campaign | blob18 | landing_page_type |
| double1 | 1 | blob19 | browser |
| double2 | engaged_ms | blob20 | label |
| double3 | max_scroll_pct | double4 | revenue (USD) |
| double5 | session_page_index | double6 | event time (ms) |

Analytics Engine samples at high volume. Always weight with `_sample_interval`.

```sql
-- Daily funnel by step
SELECT toStartOfDay(timestamp) AS day, blob1 AS event, SUM(_sample_interval) AS events,
       COUNT(DISTINCT blob4) AS devices
FROM design_yaps_funnel
WHERE timestamp > NOW() - INTERVAL '14' DAY
  AND blob1 IN ('page_view','checkout_clicked','checkout_redirected','checkout_session_created','purchase_completed')
GROUP BY day, event ORDER BY day, event;

-- Blog posts that lead to pricing (sessions with a blog view and a pricing view)
SELECT blob5 AS session, MAX(IF(blob2 = 'blog_post', 1, 0)) AS read_blog, MAX(IF(blob2 = 'pricing', 1, 0)) AS saw_pricing
FROM design_yaps_funnel
WHERE timestamp > NOW() - INTERVAL '7' DAY AND blob1 = 'page_view'
GROUP BY session;

-- Bounce rate by landing page type (sessions with exactly one page view)
SELECT landing, SUM(IF(views = 1, 1, 0)) / COUNT() AS bounce_rate, COUNT() AS sessions
FROM (
  SELECT blob5 AS session, any(blob18) AS landing, SUM(_sample_interval) AS views
  FROM design_yaps_funnel
  WHERE timestamp > NOW() - INTERVAL '7' DAY AND blob1 = 'page_view'
  GROUP BY session
) GROUP BY landing;

-- Revenue by plan
SELECT blob13 AS plan, SUM(double4 * _sample_interval) AS revenue_usd, SUM(_sample_interval) AS purchases
FROM design_yaps_funnel
WHERE blob1 = 'purchase_completed' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY plan;
```

Analytics Engine keeps data for three months. Use Mixpanel for long-term
history, cohorts and user-level journeys.

## Not tracked

- The CLI, the MCP servers and registry installs are not in this funnel yet.
  The licence and registry routes could add server events for "installed a
  Pro component" if you need activation data.
- Cloudflare Web Analytics (the dashboard RUM beacon) is separate. Enabling
  it adds Core Web Vitals and anonymous page counts but no funnels; it is a
  dashboard setting, not code.
