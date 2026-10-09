import { NextResponse } from "next/server";
import { requireUser } from "@/lib/commerce/auth";
import { commerceEnv } from "@/lib/commerce/env";

/** The redirect only displays webhook-created access. It never fulfils payment. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("session_id");
  if (!id) return NextResponse.redirect(new URL("/pricing", url));
  try {
    const env = await commerceEnv();
    const user = await requireUser(env, req);
    const licence = await env.COMMERCE_DB.prepare("SELECT id FROM licences WHERE checkout_session_id=? AND user_id=?").bind(id, user.id).first();
    return NextResponse.redirect(new URL(licence ? "/account?welcome=1" : "/account?pending=1", url));
  } catch {
    return NextResponse.redirect(new URL("/account?welcome=1", url));
  }
}
