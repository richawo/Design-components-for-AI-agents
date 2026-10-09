import { NextResponse } from "next/server";
import { licenseCookie } from "@/lib/license";
import { normalizedEmail, sessionCookie, verifyEmailCode } from "@/lib/commerce/auth";
import { commerceEnv, commerceFailure, requireSameOrigin } from "@/lib/commerce/env";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const { email, code } = await req.json();
    const result = await verifyEmailCode(await commerceEnv(), normalizedEmail(email), code, req.headers.get("cf-connecting-ip") ?? "unknown");
    const response = NextResponse.json({ user: { id: result.user.id, email: result.user.email } }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(sessionCookie(result.token, req));
    response.cookies.set({ ...licenseCookie(""), maxAge: 0 });
    return response;
  } catch (error) { return commerceFailure(error); }
}
