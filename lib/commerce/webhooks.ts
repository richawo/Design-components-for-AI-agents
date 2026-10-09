import "server-only";
import crypto from "node:crypto";
import type Stripe from "stripe";
import { APP, objectId, periodEnd, planForPrice, stripeClient, type LicenceRow } from "./billing";
import type { CommerceEnv } from "./env";
import { sendMail } from "./mail";

function invoiceSubscription(invoice: Stripe.Invoice) {
  return objectId(invoice.parent?.subscription_details?.subscription);
}

function invoiceIntent(invoice: Stripe.Invoice) {
  return objectId(invoice.payments?.data.find((p) => p.payment.type === "payment_intent")?.payment.payment_intent);
}

async function paymentState(stripe: Stripe, intentId: string | null): Promise<"active" | "refunded" | "disputed"> {
  if (!intentId) return "active"; // A paid zero-value invoice has no payment intent.
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  const charge = typeof intent.latest_charge === "string" ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge;
  if (charge && charge.amount > 0 && charge.amount_refunded >= charge.amount) return "refunded";
  if (charge?.disputed) {
    const disputes = await stripe.disputes.list({ payment_intent: intentId, limit: 100 });
    if (disputes.has_more || disputes.data.some((d) => !["won", "warning_closed"].includes(d.status))) return "disputed";
  }
  return "active";
}

async function latestInvoice(stripe: Stripe, value: string | Stripe.Invoice | null) {
  return typeof value === "string" ? stripe.invoices.retrieve(value, { expand: ["payments.data.payment.payment_intent"] }) : value;
}

export async function fulfillPurchase(env: CommerceEnv, sessionId: string, stripe = stripeClient(env)) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items.data.price.product"] });
  if (session.metadata?.app !== APP) return null;
  if (session.status !== "complete" || session.payment_status === "unpaid") return null;
  const userId = session.client_reference_id;
  const customer = objectId(session.customer);
  if (!userId || session.metadata.user_id !== userId || !customer) throw new Error("Checkout ownership unavailable");
  const user = await env.COMMERCE_DB.prepare("SELECT id, email, stripe_customer_id FROM users WHERE id=?").bind(userId)
    .first<{ id: string; email: string; stripe_customer_id: string }>();
  if (!user || user.stripe_customer_id !== customer) throw new Error("Checkout ownership mismatch");
  let priceId = session.line_items?.data[0]?.price?.id;
  let sub: Stripe.Subscription | null = null;
  let invoice: Stripe.Invoice | null = null;
  if (session.subscription) {
    sub = await stripe.subscriptions.retrieve(objectId(session.subscription)!, { expand: ["latest_invoice.payments.data.payment.payment_intent"] });
    if (sub.metadata.app !== APP || sub.metadata.user_id !== userId) throw new Error("Subscription ownership mismatch");
    priceId = sub.items.data[0]?.price.id;
    invoice = await latestInvoice(stripe, sub.latest_invoice);
  }
  const plan = priceId ? planForPrice(env, priceId) : null;
  if (!plan || plan.mode !== session.mode || session.line_items?.data.length !== 1 || session.line_items.data[0].quantity !== 1 || (sub && sub.items.data.length !== 1)) throw new Error("Checkout price is not a Design for AI plan");
  const payment = objectId(session.payment_intent) ?? (invoice ? invoiceIntent(invoice) : null);
  const paymentStatus = await paymentState(stripe, payment);
  const subActive = !sub || (sub.status === "active" && invoice?.status === "paid");
  const status = paymentStatus !== "active" ? paymentStatus : subActive ? "active" : sub && ["active", "past_due", "unpaid", "incomplete"].includes(sub.status) ? "past_due" : "canceled";
  const now = Date.now();
  const licenceId = `lic_${crypto.randomUUID()}`;
  await env.COMMERCE_DB.prepare(
    `INSERT OR IGNORE INTO licences(id, user_id, checkout_session_id, stripe_customer_id, subscription_id, payment_intent_id, plan, seats, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(licenceId, user.id, session.id, customer, sub?.id ?? null, payment, plan.id, plan.seats, status, sub ? periodEnd(sub) : null, now, now).run();
  const row = await env.COMMERCE_DB.prepare("SELECT * FROM licences WHERE checkout_session_id=?").bind(session.id).first<LicenceRow>();
  if (!row) throw new Error("Licence storage failed");
  await env.COMMERCE_DB.prepare("DELETE FROM checkout_requests WHERE session_id=?").bind(session.id).run();
  if (invoice?.status === "paid") await recordInvoice(env, row.id, invoice);
  // A duplicate Checkout event never overwrites refunds, cancellations or later plan changes.
  if (row.status === "active" && !row.welcome_sent_at) {
    await sendMail(env, {
    to: user.email, subject: "Your Design for AI licence is ready", title: "Your library is ready",
    idempotencyKey: `licence/${session.id}`,
    text: "Thank you for choosing Design for AI. Your licence is ready.\n\nSign in with the email address you used for checkout at https://design.yaps.ai/account to get your licence key and manage billing.\n\nYour key works with the CLI, MCP server and private shadcn registry. You can recover it from your account whenever you need it.",
    });
    await env.COMMERCE_DB.prepare("UPDATE licences SET welcome_sent_at=? WHERE id=?").bind(Date.now(), row.id).run();
  }
  return row;
}

async function recordInvoice(env: CommerceEnv, licenceId: string, invoice: Stripe.Invoice) {
  await env.COMMERCE_DB.prepare("INSERT OR IGNORE INTO paid_invoices(invoice_id, licence_id, payment_intent_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(invoice.id, licenceId, invoiceIntent(invoice), Date.now()).run();
}

export async function reconcileSubscription(env: CommerceEnv, subscriptionId: string, stripe = stripeClient(env)) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice.payments.data.payment.payment_intent"] });
  if (sub.metadata.app !== APP) return;
  let row = await env.COMMERCE_DB.prepare("SELECT * FROM licences WHERE subscription_id=?").bind(sub.id).first<LicenceRow>();
  if (!row) {
    const sessions = await stripe.checkout.sessions.list({ subscription: sub.id, limit: 10 });
    const session = sessions.data.find((s) => s.metadata?.app === APP && s.status === "complete");
    if (!session) throw new Error("Subscription checkout is not ready; retry this event");
    row = await fulfillPurchase(env, session.id, stripe);
  }
  if (!row || row.status === "revoked") return;
  if (sub.metadata.user_id !== row.user_id || objectId(sub.customer) !== row.stripe_customer_id) throw new Error("Subscription ownership mismatch");
  const plan = planForPrice(env, sub.items.data[0]?.price.id);
  if (!plan || plan.mode !== "subscription") throw new Error("Subscription price unavailable");
  const invoice = await latestInvoice(stripe, sub.latest_invoice);
  if (sub.status === "active" && invoice?.status === "paid") {
    const status = await paymentState(stripe, invoiceIntent(invoice));
    await env.COMMERCE_DB.prepare("UPDATE licences SET status=?, plan=?, seats=?, expires_at=?, payment_intent_id=?, updated_at=? WHERE id=? AND status!='revoked'")
      .bind(status, plan.id, plan.seats, periodEnd(sub), invoiceIntent(invoice), Date.now(), row.id).run();
    await recordInvoice(env, row.id, invoice);
  } else {
    // Never extend the paid period from an unpaid renewal invoice.
    // An unpaid upgrade invoice cannot replace the access that was already paid for.
    if (sub.status === "active" && row.status === "active" && (row.expires_at ?? 0) > Date.now() / 1000) return;
    const status = ["active", "past_due", "unpaid", "incomplete"].includes(sub.status) ? "past_due" : "canceled";
    await env.COMMERCE_DB.prepare("UPDATE licences SET status=?, updated_at=? WHERE id=? AND status!='revoked'").bind(status, Date.now(), row.id).run();
  }
}

export async function revokeLicence(env: CommerceEnv, id: string) {
  await env.COMMERCE_DB.prepare("UPDATE licences SET status='revoked', updated_at=? WHERE id=?").bind(Date.now(), id).run();
}

async function licencesForPayment(env: CommerceEnv, payment: string) {
  return (await env.COMMERCE_DB.prepare(
    "SELECT * FROM licences WHERE payment_intent_id=?",
  ).bind(payment).all<LicenceRow>()).results;
}

async function reconcilePayment(env: CommerceEnv, payment: string, stripe: Stripe) {
  for (const row of await licencesForPayment(env, payment)) {
    if (row.status === "revoked") continue;
    if (row.subscription_id) await reconcileSubscription(env, row.subscription_id, stripe);
    else await env.COMMERCE_DB.prepare("UPDATE licences SET status=?, updated_at=? WHERE id=? AND status!='revoked'")
      .bind(await paymentState(stripe, payment), Date.now(), row.id).run();
  }
}

export async function processBillingEvent(env: CommerceEnv, event: Stripe.Event, stripe = stripeClient(env)) {
  const now = Date.now();
  const acquired = await env.COMMERCE_DB.prepare(
    `INSERT INTO billing_events(id, type, state, lease_until, updated_at) VALUES (?, ?, 'processing', ?, ?)
     ON CONFLICT(id) DO UPDATE SET state='processing', lease_until=excluded.lease_until, updated_at=excluded.updated_at
     WHERE billing_events.state!='done' AND billing_events.lease_until<=? RETURNING id`,
  ).bind(event.id, event.type, now + 300_000, now, now).first();
  if (!acquired) {
    const old = await env.COMMERCE_DB.prepare("SELECT state FROM billing_events WHERE id=?").bind(event.id).first<{ state: string }>();
    if (old?.state === "done") return;
    throw new Error("Event is already being processed");
  }
  try {
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      await fulfillPurchase(env, (event.data.object as Stripe.Checkout.Session).id, stripe);
    } else if (["checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) {
      await env.COMMERCE_DB.prepare("DELETE FROM checkout_requests WHERE session_id=?").bind((event.data.object as Stripe.Checkout.Session).id).run();
    } else if (event.type.startsWith("customer.subscription.")) {
      await reconcileSubscription(env, (event.data.object as Stripe.Subscription).id, stripe);
    } else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      const invoice = await stripe.invoices.retrieve((event.data.object as Stripe.Invoice).id);
      const subscription = invoiceSubscription(invoice);
      if (subscription) await reconcileSubscription(env, subscription, stripe);
    } else if (event.type === "charge.refunded") {
      const charge = await stripe.charges.retrieve(event.data.object.id);
      const payment = objectId(charge.payment_intent);
      if (payment) await reconcilePayment(env, payment, stripe);
    } else if (["charge.dispute.created", "charge.dispute.closed"].includes(event.type)) {
      const dispute = event.data.object as Stripe.Dispute;
      const payment = objectId(dispute.payment_intent);
      if (payment) await reconcilePayment(env, payment, stripe);
    }
    await env.COMMERCE_DB.prepare("UPDATE billing_events SET state='done', lease_until=0, updated_at=? WHERE id=?").bind(Date.now(), event.id).run();
  } catch (error) {
    await env.COMMERCE_DB.prepare("UPDATE billing_events SET state='failed', lease_until=0, updated_at=? WHERE id=?").bind(Date.now(), event.id).run();
    throw error;
  }
}
