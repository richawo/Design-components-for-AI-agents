import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { commerceFixture } from "./commerce-db";
import { APP, startCheckout, withBillingLock } from "@/lib/commerce/billing";
import { fulfillPurchase, processBillingEvent, reconcileSubscription } from "@/lib/commerce/webhooks";
import { accountDetails, verifiedStoredKey } from "@/lib/commerce/licences";
import { signLicense } from "@/lib/license";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture(subscription = false) {
  const { env, sql } = commerceFixture();
  env.STRIPE_PRICE_PRO_LIFETIME = "price_life";
  env.STRIPE_PRICE_PRO_YEARLY = "price_year";
  env.STRIPE_PRICE_TEAM_LIFETIME = "price_team";
  const user = { id: "usr_owner", email: "owner@example.invalid", stripe_customer_id: "cus_design" };
  sql.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run(user.id, user.email, user.stripe_customer_id, Date.now());
  const session = { id: "cs_design", customer: user.stripe_customer_id, client_reference_id: user.id, metadata: { app: APP, user_id: user.id },
    status: "complete", payment_status: "paid", mode: subscription ? "subscription" : "payment", subscription: subscription ? "sub_design" : null,
    payment_intent: subscription ? null : "pi_design", line_items: { data: [{ price: { id: subscription ? "price_year" : "price_life" }, quantity: 1 }] } };
  const invoice = { id: "in_design", status: "paid", parent: { subscription_details: { subscription: "sub_design" } },
    payments: { data: [{ payment: { type: "payment_intent", payment_intent: "pi_design" } }] } };
  const sub = { id: "sub_design", customer: user.stripe_customer_id, metadata: { app: APP, user_id: user.id }, status: "active",
    latest_invoice: invoice, items: { data: [{ price: { id: "price_year" }, current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400 }] } };
  const charge = { id: "ch_design", payment_intent: "pi_design", amount: 17900, amount_refunded: 0, disputed: false };
  const disputes: { status: string }[] = [];
  const client = {
    checkout: { sessions: { retrieve: vi.fn(async () => session), list: vi.fn(async () => ({ data: [session] })), create: vi.fn(), expire: vi.fn() } },
    subscriptions: { retrieve: vi.fn(async () => sub) }, invoices: { retrieve: vi.fn(async () => invoice) },
    paymentIntents: { retrieve: vi.fn(async () => ({ latest_charge: charge })) }, charges: { retrieve: vi.fn(async () => charge) },
    disputes: { list: vi.fn(async () => ({ data: disputes, has_more: false })) },
    prices: { retrieve: vi.fn(async () => ({ active: true, currency: "usd", unit_amount: 17900, recurring: null, metadata: { plan: "pro-lifetime" }, product: { metadata: { app: APP } } })) },
    customers: { retrieve: vi.fn(async () => ({ id: user.stripe_customer_id, metadata: { app: APP, user_id: user.id } })), create: vi.fn() },
  };
  const mail = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal("fetch", mail);
  return { env, sql, user, session, invoice, sub, charge, disputes, client, stripe: client as unknown as Stripe, mail };
}
const event = (id: string, type: string, object: unknown) => ({ id, type, data: { object } } as Stripe.Event);

describe("payment fulfilment", () => {
  it("never grants access for unpaid or unrelated checkout, and grants one licence and one email after payment", async () => {
    const f = fixture();
    f.session.payment_status = "unpaid";
    expect(await fulfillPurchase(f.env, f.session.id, f.stripe)).toBeNull();
    f.session.payment_status = "paid";
    f.session.metadata.app = "another-app";
    expect(await fulfillPurchase(f.env, f.session.id, f.stripe)).toBeNull();
    expect(f.mail).not.toHaveBeenCalled();
    f.session.metadata.app = APP;
    const first = await fulfillPurchase(f.env, f.session.id, f.stripe);
    const second = await fulfillPurchase(f.env, f.session.id, f.stripe);
    expect(second?.id).toBe(first?.id);
    expect(f.sql.prepare("SELECT count(*) AS n FROM licences").get()!.n).toBe(1);
    expect(f.mail).toHaveBeenCalledTimes(1);
    f.sql.close();
  });

  it("rejects a checkout for another customer or an unexpected price/quantity", async () => {
    const f = fixture();
    f.session.customer = "cus_other";
    await expect(fulfillPurchase(f.env, f.session.id, f.stripe)).rejects.toThrow("ownership mismatch");
    f.session.customer = f.user.stripe_customer_id;
    f.session.line_items.data[0].quantity = 10;
    await expect(fulfillPurchase(f.env, f.session.id, f.stripe)).rejects.toThrow("not a Design");
    f.session.line_items.data[0].quantity = 1;
    f.session.line_items.data[0].price.id = "price_foreign";
    await expect(fulfillPurchase(f.env, f.session.id, f.stripe)).rejects.toThrow("not a Design");
    expect(f.sql.prepare("SELECT count(*) AS n FROM licences").get()!.n).toBe(0);
    f.sql.close();
  });

  it("persists paid access before email delivery, retries failed events and deduplicates successes", async () => {
    const f = fixture();
    f.mail.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    const e = event("evt_retry", "checkout.session.completed", f.session);
    await expect(processBillingEvent(f.env, e, f.stripe)).rejects.toThrow();
    expect(f.sql.prepare("SELECT status FROM licences").get()!.status).toBe("active");
    expect(f.sql.prepare("SELECT state FROM billing_events").get()!.state).toBe("failed");
    await processBillingEvent(f.env, e, f.stripe);
    await processBillingEvent(f.env, e, f.stripe);
    expect(f.mail).toHaveBeenCalledTimes(2);
    expect(f.sql.prepare("SELECT state FROM billing_events").get()!.state).toBe("done");
    f.sql.close();
  });

  it("uses current Stripe state for out-of-order renewal events and never extends an unpaid period", async () => {
    const f = fixture(true);
    const row = await fulfillPurchase(f.env, f.session.id, f.stripe);
    const oldExpiry = row!.expires_at;
    f.invoice.status = "open"; f.sub.status = "past_due";
    f.sub.items.data[0].current_period_end += 365 * 86400;
    await reconcileSubscription(f.env, f.sub.id, f.stripe);
    expect(f.sql.prepare("SELECT status, expires_at FROM licences").get()).toMatchObject({ status: "past_due", expires_at: oldExpiry });
    f.invoice.status = "paid"; f.sub.status = "active";
    // Even an old failed-payment event must reconcile the current, paid invoice.
    await processBillingEvent(f.env, event("evt_old_failure", "invoice.payment_failed", f.invoice), f.stripe);
    expect(f.sql.prepare("SELECT status, expires_at FROM licences").get()).toMatchObject({ status: "active", expires_at: f.sub.items.data[0].current_period_end });
    f.sub.status = "canceled";
    await reconcileSubscription(f.env, f.sub.id, f.stripe);
    expect(f.sql.prepare("SELECT status FROM licences").get()!.status).toBe("canceled");
    f.sql.close();
  });

  it("handles a subscription event arriving before checkout fulfilment", async () => {
    const f = fixture(true);
    await reconcileSubscription(f.env, f.sub.id, f.stripe);
    expect(f.sql.prepare("SELECT subscription_id, status FROM licences").get()).toMatchObject({ subscription_id: f.sub.id, status: "active" });
    f.sql.close();
  });

  it("removes access after a full refund, preserves partial refunds, and restores a won dispute", async () => {
    const f = fixture();
    await fulfillPurchase(f.env, f.session.id, f.stripe);
    f.charge.amount_refunded = 500;
    await processBillingEvent(f.env, event("evt_partial", "charge.refunded", f.charge), f.stripe);
    expect(f.sql.prepare("SELECT status FROM licences").get()!.status).toBe("active");
    f.charge.disputed = true; f.disputes.push({ status: "needs_response" });
    await processBillingEvent(f.env, event("evt_disputed", "charge.dispute.created", { id: "dp_design", payment_intent: "pi_design" }), f.stripe);
    expect(f.sql.prepare("SELECT status FROM licences").get()!.status).toBe("disputed");
    f.disputes[0].status = "won";
    await processBillingEvent(f.env, event("evt_won", "charge.dispute.closed", { id: "dp_design", payment_intent: "pi_design" }), f.stripe);
    expect(f.sql.prepare("SELECT status FROM licences").get()!.status).toBe("active");
    f.charge.amount_refunded = f.charge.amount;
    await processBillingEvent(f.env, event("evt_full", "charge.refunded", f.charge), f.stripe);
    await fulfillPurchase(f.env, f.session.id, f.stripe);
    expect(f.sql.prepare("SELECT status FROM licences").get()!.status).toBe("refunded");
    f.sql.close();
  });
});

describe("checkout safeguards", () => {
  it("reuses pending checkout across repeated taps and prevents another charge while fulfilment is pending", async () => {
    const f = fixture();
    f.session.status = "open";
    const open = { ...f.session, url: "https://checkout.stripe.com/fixture" };
    f.client.checkout.sessions.retrieve.mockResolvedValue(open);
    f.client.checkout.sessions.create.mockResolvedValue(open);
    expect(await startCheckout(f.env, f.user, "pro-lifetime", f.stripe)).toBe(open.url);
    expect(await startCheckout(f.env, f.user, "pro-lifetime", f.stripe)).toBe(open.url);
    expect(f.client.checkout.sessions.create).toHaveBeenCalledTimes(1);
    open.status = "complete";
    await expect(startCheckout(f.env, f.user, "pro-lifetime", f.stripe)).rejects.toMatchObject({ status: 409 });
    f.sql.close();
  });

  it("uses identical create parameters after an ambiguous Stripe timeout", async () => {
    const f = fixture();
    f.client.checkout.sessions.create.mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({ id: f.session.id, url: "https://checkout.stripe.com/fixture" });
    await expect(startCheckout(f.env, f.user, "pro-lifetime", f.stripe)).rejects.toThrow("timeout");
    await startCheckout(f.env, f.user, "pro-lifetime", f.stripe);
    expect(f.client.checkout.sessions.create.mock.calls[1]).toEqual(f.client.checkout.sessions.create.mock.calls[0]);
    expect(f.sql.prepare("SELECT count(*) AS n FROM billing_locks").get()!.n).toBe(0);
    f.sql.close();
  });

  it("rejects competing billing updates and always releases a failed update's lock", async () => {
    const f = fixture();
    await withBillingLock(f.env, f.user.id, async () => {
      await expect(withBillingLock(f.env, f.user.id, async () => null)).rejects.toMatchObject({ status: 409 });
    });
    await expect(withBillingLock(f.env, f.user.id, async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    expect(f.sql.prepare("SELECT count(*) AS n FROM billing_locks").get()!.n).toBe(0);
    f.sql.close();
  });
});

describe("recoverable account keys", () => {
  it("revokes existing keys immediately, survives paid renewal, and enforces each team member's identity", async () => {
    const f = fixture(true);
    const row = await fulfillPurchase(f.env, f.session.id, f.stripe);
    const account = await accountDetails(f.env, f.user);
    const token = account.licences[0].token!;
    expect((await verifiedStoredKey(f.env, token)).ok).toBe(true);
    f.sql.prepare("UPDATE licences SET status='refunded'").run();
    expect(await verifiedStoredKey(f.env, token)).toMatchObject({ ok: false, reason: "revoked" });
    f.sql.prepare("UPDATE licences SET status='active'").run();
    const expired = signLicense({ id: row!.id, email: f.user.email, userId: f.user.id, plan: "pro-yearly", seats: 1, exp: 1 }, 2);
    expect((await verifiedStoredKey(f.env, expired)).ok).toBe(true);
    f.sql.prepare("INSERT INTO users VALUES (?, ?, NULL, ?)").run("usr_member", "member@example.invalid", Date.now());
    f.sql.prepare("UPDATE licences SET seats=10, plan='team-yearly'").run();
    f.sql.prepare("INSERT INTO team_members VALUES (?, ?, ?)").run(row!.id, "member@example.invalid", Date.now());
    const memberKey = signLicense({ id: row!.id, email: "member@example.invalid", userId: "usr_member", plan: "pro-yearly", seats: 1, exp: row!.expires_at }, 2);
    expect((await verifiedStoredKey(f.env, memberKey)).ok).toBe(true);
    const wrongId = signLicense({ id: row!.id, email: "member@example.invalid", userId: "usr_other", plan: "pro-yearly", seats: 1, exp: row!.expires_at }, 2);
    expect((await verifiedStoredKey(f.env, wrongId)).ok).toBe(false);
    f.sql.prepare("DELETE FROM team_members").run();
    expect((await verifiedStoredKey(f.env, memberKey)).ok).toBe(false);
    f.sql.close();
  });
});
