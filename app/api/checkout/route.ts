import { planById } from "@/lib/pricing";
import { createCheckout } from "@/lib/stripe";

export async function POST(req: Request) {
  const { plan: planId } = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = planId ? planById(planId) : undefined;
  if (!plan) return Response.json({ error: "Unknown plan" }, { status: 400 });
  const price = process.env[plan.stripePriceEnv];
  if (!price || !process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Checkout isn't configured yet. Set STRIPE_SECRET_KEY and the STRIPE_PRICE_* variables." }, { status: 503 });
  }
  const origin = new URL(req.url).origin;
  try {
    const session = await createCheckout({ price, mode: plan.mode, plan: plan.id, origin });
    return Response.json({ url: session.url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
