import { NextResponse } from "next/server";
import { licenseCookie, licenseFromRequest, signLicense, verifyLicense } from "@/lib/license";
import { getSubscription, periodEnd } from "@/lib/stripe";

/** Returns the current licence, renewing a yearly one while its subscription is active. */
export async function GET(req: Request) {
  const token = licenseFromRequest(req);
  const v = verifyLicense(token);
  if (v.ok) return NextResponse.json({ active: true, license: v.license, token }, { headers: { "Cache-Control": "no-store" } });

  if (v.reason === "expired" && v.license?.subId && process.env.STRIPE_SECRET_KEY) {
    try {
      const sub = await getSubscription(v.license.subId);
      if (sub.status === "active" || sub.status === "trialing") {
        const { id, email, plan, seats, subId } = v.license;
        const renewed = signLicense({ id, email, plan, seats, subId, exp: periodEnd(sub) + 7 * 86400 });
        const res = NextResponse.json({ active: true, license: verifyLicense(renewed).ok ? { ...v.license, exp: periodEnd(sub) } : v.license, token: renewed });
        res.cookies.set(licenseCookie(renewed));
        return res;
      }
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json({ active: false, reason: v.reason }, { headers: { "Cache-Control": "no-store" } });
}
