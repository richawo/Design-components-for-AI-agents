import { NextResponse } from "next/server";
import { licenseCookie, signLicense } from "@/lib/license";
import { planById } from "@/lib/pricing";
import { getCheckout, getSubscription, periodEnd } from "@/lib/stripe";

/** Stripe redirects here after payment. We verify the session and issue a licence. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("session_id");
  if (!id) return NextResponse.redirect(new URL("/pricing", url));
  try {
    const session = await getCheckout(id);
    const plan = planById(session.metadata?.plan ?? "");
    const paid = session.status === "complete" && session.payment_status !== "unpaid";
    if (!plan || !paid) return NextResponse.redirect(new URL("/pricing?unpaid=1", url));

    let exp: number | null = null;
    let subId: string | undefined;
    if (plan.mode === "subscription" && session.subscription) {
      subId = session.subscription;
      exp = periodEnd(await getSubscription(subId)) + 7 * 86400;
    }
    // The checkout session id doubles as the licence id, so a refresh of this URL re-issues the same licence.
    const token = signLicense({ id: session.id, email: session.customer_details?.email ?? "", plan: plan.id, seats: plan.seats, exp, subId });
    const res = NextResponse.redirect(new URL("/account?welcome=1", url));
    res.cookies.set(licenseCookie(token));
    return res;
  } catch {
    return NextResponse.redirect(new URL("/pricing?error=claim", url));
  }
}
