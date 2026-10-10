# Accounts and payments

Design for AI uses email-code sign-in and hosted Stripe Checkout, following the desktop product's flow. It has its own account records, Stripe customers, products, billing portal and commerce database. A desktop subscription does not grant a Design for AI licence.

## Customer flow

1. Choose a Pro or Team plan on `/pricing`.
2. Sign in at `/account` with a six-digit email code. Codes expire after 15 minutes, permit five guesses and can be used once. Requests have email and IP limits plus a 30-second resend cooldown.
3. Continue to Stripe Checkout. Annual plans renew each year; lifetime plans charge once.
4. Stripe's signed payment events create the licence. The success redirect only reads the account, so returning from checkout cannot unlock an unpaid purchase.
5. A transactional email links to the account. Sign in with the purchase email on any device to recover the licence key. Keys are masked until revealed and can be copied directly.
6. Owners use **Manage billing** for invoices, payment methods, annual plan changes and cancellation at the end of the paid period. Lifetime purchases have invoices but no recurring subscription.

Team owners use one of the 10 seats and can invite nine additional email addresses. Each member signs in with the invited address and receives a personal key. Only the owner manages seats and billing. Removing a member disables their key immediately. Invitations are stored before email delivery and can be retried without allocating another seat.

## Entitlements and billing events

Version 2 keys carry a signed account identity and licence ID. Every Pro request checks D1 for the current paid period and team membership. This applies to source downloads, registry items, source panels and the remote MCP server. The same key continues working after a paid annual renewal. Version 1 manual keys retain their original expiry and revocation contract.

- Unpaid Checkout sessions do not grant access. Asynchronous payments wait for success.
- Repeated Checkout taps reuse a pending session. A durable request ID, identical parameters and an account lock prevent duplicate sessions after timeouts. Changing plans expires the previous open session.
- Webhook events have processing leases and durable success records. Retries do not create duplicate licences or resend a welcome email after it was acknowledged.
- Subscription events retrieve current Stripe state. Old events cannot overwrite a later paid renewal. Unpaid invoices never extend a paid period or grant a more expensive plan. An unpaid upgrade preserves the previously paid access until its existing expiry.
- Full refunds remove access for the affected current payment; partial refunds keep it. A refund of an older subscription invoice does not erase a later paid period. A later paid renewal can restore access.
- Open or lost disputes suspend access. A won dispute restores access when the current payment and subscription remain valid. Manual revocations remain revoked.
- A plan downgrade to one seat disables member access. Previously downloaded code remains governed by the licence terms.

The Worker checks the raw Stripe signature before processing an event. The endpoint is `https://design.yaps.ai/api/billing/webhook` and uses API version `2026-09-30.endive`.

## Operational setup

D1: `design-yaps-commerce`, binding `COMMERCE_DB`, database ID `d1a4a9fc-8234-45c1-a524-f44614c62b3b`. Apply migrations before deploying code that needs a new column:

```bash
npx wrangler d1 migrations apply COMMERCE_DB --remote
```

Encrypted runtime secrets are `AUTH_SECRET`, `LICENSE_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `RESEND_API_KEY`. Do not rotate `LICENSE_SECRET` casually: it signs existing keys. Rotating `AUTH_SECRET` invalidates sessions and outstanding codes.

Use a dedicated restricted Stripe key with these permissions:

| Resource | Permission |
| --- | --- |
| Customers | Write |
| Checkout Sessions | Write |
| Customer Portal | Write |
| Products, Prices | Read |
| Subscriptions, Invoices | Read |
| Payment Intents, Charges and Refunds, Payment Disputes | Read |
| Tax Settings and Registrations | Read |

The runtime does not need permission to create prices, manage webhook endpoints, issue refunds or alter desktop billing. Administrative setup uses the authenticated Stripe connection separately.

Resend uses a sending-only key restricted to `yaps.ai`. The sender is `Design for AI <hello@yaps.ai>`. Transactional code, licence and invitation emails do not opt users into marketing.

The four price IDs and the dedicated portal configuration are plain variables in `wrangler.jsonc`. Product metadata uses `app=design-yaps`; subscription metadata also binds the account ID. Price validation checks product ownership, currency, amount, cadence and plan before creating checkout.

## Tax configuration

No active Stripe Tax registrations were returned during setup. `STRIPE_AUTOMATIC_TAX` is therefore `false`. This is a configuration fact, not a determination of the business's tax obligations. Confirm the appropriate registrations with the merchant before enabling tax collection. The integration supports automatic tax once those registrations and Stripe Tax settings are ready.

## Verification

Run the registry validator, TypeScript and Vitest before pushing. The commerce tests cover real SQLite statements for atomic code consumption, rate limits, durable fulfilment, retries, renewal failures, refunds, disputes, ownership, member removal and seat capacity.

Use a separate Stripe sandbox for purchases. Test keys, price IDs, portal and signing secret belong together; never point test payments at the production D1 database. A local Worker can receive real sandbox events through `stripe listen --forward-to http://localhost:8793/api/billing/webhook`. Store the listener's signing secret privately in the local bindings. Sandbox email subjects are explicitly labelled and account links follow the local site URL.

Check sign-in delivery, a hosted test-card purchase, the account key, a Pro download, billing management, a full test refund and recovery after sign-out. A successful signature probe alone does not replace a purchase test. Preserve private test credentials and email codes outside Git and redact them from reports.
