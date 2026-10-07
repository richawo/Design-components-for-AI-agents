import "server-only";

/** A tiny Stripe REST client: two calls don't justify the SDK. */
const API = "https://api.stripe.com/v1";

function key() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY is not set");
  return k;
}

function form(data: Record<string, string | number | boolean | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined) body.append(k, String(v));
  return body;
}

async function stripe<T>(path: string, init?: { method?: string; body?: URLSearchParams }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: init?.body,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status}`);
  return json as T;
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  mode: "payment" | "subscription";
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  customer_details: { email: string | null } | null;
  subscription: string | null;
  metadata: Record<string, string>;
};

export function createCheckout(opts: { price: string; mode: "payment" | "subscription"; plan: string; origin: string }) {
  return stripe<CheckoutSession>("/checkout/sessions", {
    method: "POST",
    body: form({
      mode: opts.mode,
      "line_items[0][price]": opts.price,
      "line_items[0][quantity]": 1,
      success_url: `${opts.origin}/api/license/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${opts.origin}/pricing?cancelled=1`,
      allow_promotion_codes: true,
      "metadata[plan]": opts.plan,
      ...(opts.mode === "payment" ? { customer_creation: "always", "invoice_creation[enabled]": true } : {}),
    }),
  });
}

export const getCheckout = (id: string) => stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(id)}`);

export type Subscription = { id: string; status: string; current_period_end?: number; items?: { data: { current_period_end?: number }[] } };
export const getSubscription = (id: string) => stripe<Subscription>(`/subscriptions/${encodeURIComponent(id)}`);

export function periodEnd(sub: Subscription) {
  return sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? Math.floor(Date.now() / 1000) + 366 * 86400;
}
