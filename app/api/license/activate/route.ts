import { NextResponse } from "next/server";
import { licenseCookie, signLicense, verifyLicense } from "@/lib/license";
import { verifiedStoredKey } from "@/lib/commerce/licences";
import { commerceEnv, commerceFailure, requireSameOrigin, privateJson } from "@/lib/commerce/env";

/** Activate an existing key on a browser. Account keys always check current billing and seat ownership. */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const { token } = await req.json() as { token?: unknown };
    if (typeof token !== "string" || token.length > 4096) return privateJson({ active: false, reason: "malformed" }, 400);
    const parsed = verifyLicense(token);
    const payload = parsed.license;
    const result = payload?.v === 2 ? await verifiedStoredKey(await commerceEnv(), token) : parsed;
    if (!result.ok) return privateJson({ active: false, reason: result.reason }, 400);
    const renewed = result.license.v === 2 ? signLicense(result.license, 2) : token.trim();
    const response = NextResponse.json({ active: true, license: result.license }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(licenseCookie(renewed));
    return response;
  } catch (error) { return commerceFailure(error); }
}
