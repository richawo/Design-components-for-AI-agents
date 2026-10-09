import Stripe from "stripe";
import { stripeClient } from "@/lib/commerce/billing";
import { commerceEnv, commerceFailure, privateJson } from "@/lib/commerce/env";
import { processBillingEvent } from "@/lib/commerce/webhooks";

export async function POST(req: Request) {
  try {
    const env = await commerceEnv();
    if (!env.STRIPE_WEBHOOK_SECRET) return privateJson({ error: "Billing events are unavailable." }, 503);
    const signature = req.headers.get("stripe-signature");
    if (!signature) return privateJson({ error: "Missing signature." }, 400);
    const raw = await req.text();
    if (raw.length > 1_000_000) return privateJson({ error: "Event too large." }, 413);
    const stripe = stripeClient(env);
    let event;
    try { event = await stripe.webhooks.constructEventAsync(raw, signature, env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider()); }
    catch { return privateJson({ error: "Invalid signature." }, 400); }
    await processBillingEvent(env, event, stripe);
    return privateJson({ received: true });
  } catch (error) { return commerceFailure(error); }
}
