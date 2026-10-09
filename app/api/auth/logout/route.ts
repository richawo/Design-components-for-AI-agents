import { NextResponse } from "next/server";
import { logoutSession, sessionCookie } from "@/lib/commerce/auth";
import { commerceEnv, commerceFailure, requireSameOrigin } from "@/lib/commerce/env";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    await logoutSession(await commerceEnv(), req);
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(sessionCookie("", req, true));
    return response;
  } catch (error) { return commerceFailure(error); }
}
