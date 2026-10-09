import "server-only";
import crypto from "node:crypto";
import Stripe from "stripe";
import { PLANS, planById } from "@/lib/pricing";
import type { Plan } from "@/lib/license";
import type { CommerceEnv } from "./env";
import { CommerceError } from "./env";
import type { AccountUser } from "./auth";

export const APP = "design-yaps";
export const objectId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id ?? null;

export function stripeClient(env: CommerceEnv) {
  if (!env.STRIPE_SECRET_KEY) throw new CommerceError(503, "Checkout is temporarily unavailable. Please try again shortly.");
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-09-30.endive", httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2, timeout: 10_000 });
}

export function planForPrice(env: CommerceEnv, id: string) {
  return PLANS.find((p) => env[p.stripePriceEnv as keyof CommerceEnv] === id);
}

export const appUrl = (env: CommerceEnv) => (env.NEXT_PUBLIC_SITE_URL || "https://design.yaps.ai").replace(/\/$/, "");

export async function withBillingLock<T>(env: CommerceEnv, userId: string, action: () => Promise<T>) {
  const owner = crypto.randomUUID(), now = Date.now();
  const lock = await env.COMMERCE_DB.prepare(
    `INSERT INTO billing_locks(user_id, owner, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET owner=excluded.owner, expires_at=excluded.expires_at
     WHERE billing_locks.expires_at<=?`,
  ).bind(userId, owner, now + 300_000, now).run();
  if (lock.meta.changes !== 1) throw new CommerceError(409, "A billing update is already in progress. Please try again shortly.");
  try { return await action(); }
  finally { await env.COMMERCE_DB.prepare("DELETE FROM billing_locks WHERE user_id=? AND owner=?").bind(userId, owner).run(); }
}

async function customerFor(env: CommerceEnv, user: AccountUser, stripe: Stripe) {
  // The session's user was read before acquiring the lock; another checkout may have created a customer meanwhile.
  const current = await env.COMMERCE_DB.prepare("SELECT stripe_customer_id FROM users WHERE id=?").bind(user.id).first<{ stripe_customer_id: string | null }>();
  if (current?.stripe_customer_id) {
    const customer = await stripe.customers.retrieve(current.stripe_customer_id);
    if (customer.deleted || customer.metadata.app !== APP || customer.metadata.user_id !== user.id) throw new Error("Customer ownership mismatch");
    return customer.id;
  }
  const customer = await stripe.customers.create({ email: user.email, metadata: { app: APP, user_id: user.id } }, { idempotencyKey: `${APP}:customer:${user.id}` });
  await env.COMMERCE_DB.prepare("UPDATE users SET stripe_customer_id=? WHERE id=? AND stripe_customer_id IS NULL").bind(customer.id, user.id).run();
  return customer.id;
}

export async function startCheckout(env: CommerceEnv, user: AccountUser, planId: string, stripe = stripeClient(env)) {
  const plan = planById(planId);
  if (!plan) throw new CommerceError(400, "Choose a valid plan.");
  const priceId = env[plan.stripePriceEnv as keyof CommerceEnv];
  if (typeof priceId !== "string" || !priceId.startsWith("price_")) throw new CommerceError(503, "This plan is temporarily unavailable.");
  return withBillingLock(env, user.id, async () => {
    const existing = await env.COMMERCE_DB.prepare(
      "SELECT id FROM licences WHERE user_id=? AND (status='active' OR (subscription_id IS NOT NULL AND status!='canceled')) LIMIT 1",
    ).bind(user.id).first();
    if (existing) throw new CommerceError(409, "You already have a licence. Manage it from your account to avoid another charge.");
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const product = typeof price.product === "string" ? null : price.product;
    if (!price.active || price.currency !== "usd" || price.unit_amount !== plan.price * 100 || !product || product.deleted || product.metadata.app !== APP || price.metadata.plan !== plan.id || Boolean(price.recurring) !== (plan.mode === "subscription") || (price.recurring && (price.recurring.interval !== "year" || price.recurring.interval_count !== 1))) {
      throw new Error("Configured price does not match this product");
    }
    const customer = await customerFor(env, user, stripe);
    type Pending = { id: string; plan_id: string; session_id: string | null; integration_label: string; expires_at: number };
    let pending = await env.COMMERCE_DB.prepare("SELECT * FROM checkout_requests WHERE user_id=?").bind(user.id).first<Pending>();
    if (pending?.session_id) {
      const previous = await stripe.checkout.sessions.retrieve(pending.session_id);
      if (objectId(previous.customer) !== customer || previous.metadata?.user_id !== user.id || previous.metadata?.app !== APP) throw new Error("Pending checkout ownership mismatch");
      if (previous.status === "complete") throw new CommerceError(409, "Your payment is being processed. Your licence will appear in your account shortly.");
      if (previous.status === "open" && pending.plan_id === plan.id && previous.url) return previous.url;
      if (previous.status === "open") await stripe.checkout.sessions.expire(previous.id);
      pending = null;
    } else if (pending && (pending.plan_id !== plan.id || pending.expires_at < Date.now() / 1000 + 1800)) {
      // Keep at least Stripe's minimum 30-minute expiry when retrying a request that never reached Stripe.
      pending = null;
    }
    if (!pending) {
      pending = { id: crypto.randomUUID(), plan_id: plan.id, session_id: null, expires_at: Math.floor(Date.now() / 1000) + 3600,
        integration_label: `${APP}-${Array.from({ length: 8 }, () => String.fromCharCode(97 + crypto.randomInt(26))).join("")}` };
      await env.COMMERCE_DB.prepare(
        `INSERT INTO checkout_requests(user_id, id, plan_id, session_id, integration_label, expires_at) VALUES (?, ?, ?, NULL, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET id=excluded.id, plan_id=excluded.plan_id, session_id=NULL, integration_label=excluded.integration_label, expires_at=excluded.expires_at`,
      ).bind(user.id, pending.id, pending.plan_id, pending.integration_label, pending.expires_at).run();
    }
    const params: Stripe.Checkout.SessionCreateParams = {
      customer, client_reference_id: user.id, mode: plan.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl(env)}/api/license/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl(env)}/pricing?cancelled=1`, allow_promotion_codes: true,
      billing_address_collection: "auto", customer_update: { address: "auto" },
      metadata: { app: APP, user_id: user.id, plan: plan.id },
      integration_identifier: pending.integration_label, expires_at: pending.expires_at,
      ...(env.STRIPE_AUTOMATIC_TAX === "true" ? { automatic_tax: { enabled: true } } : {}),
      ...(plan.mode === "subscription" ? { subscription_data: { metadata: { app: APP, user_id: user.id } } } : { invoice_creation: { enabled: true }, payment_intent_data: { metadata: { app: APP, user_id: user.id } } }),
    };
    // Persist the request before calling Stripe so retries after a timeout use identical parameters and key.
    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `${APP}:checkout:${pending.id}` });
    if (!session.url) throw new Error("Checkout returned no URL");
    await env.COMMERCE_DB.prepare("UPDATE checkout_requests SET session_id=? WHERE user_id=? AND id=?").bind(session.id, user.id, pending.id).run();
    return session.url;
  });
}

export async function billingPortal(env: CommerceEnv, user: AccountUser, stripe = stripeClient(env)) {
  if (!user.stripe_customer_id) throw new CommerceError(400, "There is no billing account to manage yet.");
  const customer = await stripe.customers.retrieve(user.stripe_customer_id);
  if (customer.deleted || customer.metadata.app !== APP || customer.metadata.user_id !== user.id) throw new Error("Customer ownership mismatch");
  if (!env.STRIPE_PORTAL_CONFIGURATION) throw new CommerceError(503, "Billing management is temporarily unavailable.");
  const portal = await stripe.billingPortal.sessions.create({ customer: customer.id, configuration: env.STRIPE_PORTAL_CONFIGURATION, return_url: `${appUrl(env)}/account` });
  return portal.url;
}

export type LicenceRow = {
  id: string; user_id: string; checkout_session_id: string; stripe_customer_id: string;
  subscription_id: string | null; payment_intent_id: string | null; plan: Plan; seats: number;
  status: string; expires_at: number | null; created_at: number; updated_at: number; owner_email?: string; welcome_sent_at?: number | null;
};

export function periodEnd(sub: Stripe.Subscription) {
  const end = Math.max(...sub.items.data.map((item) => item.current_period_end));
  if (!Number.isFinite(end) || end <= 0) throw new Error("Subscription period unavailable");
  return end;
}
