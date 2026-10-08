import { planById } from "@/lib/pricing";
import { site } from "@/lib/site";
import { createCheckout } from "@/lib/stripe";

export async function POST(req: Request) {
  const { plan: planId } = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = planId ? planById(planId) : undefined;
  if (!plan) return Response.json({ error: "Unknown plan" }, { status: 400 });
  const price = process.env[plan.stripePriceEnv];
  if (!price || !process.env.STRIPE_SECRET_KEY) {
    // Visitors see a human message; the missing configuration goes to the logs.
    console.error(`checkout: STRIPE_SECRET_KEY or ${plan.stripePriceEnv} is not set`);
    return Response.json({ error: `Checkout is unavailable right now. Email ${site.email} and we'll sort it out.` }, { status: 503 });
  }
  const origin = new URL(req.url).origin;
  try {
    const session = await createCheckout({ price, mode: plan.mode, plan: plan.id, origin });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("checkout:", (e as Error).message);
    return Response.json({ error: "Couldn't open checkout just now. Try again in a moment." }, { status: 502 });
  }
}
