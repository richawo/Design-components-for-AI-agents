import { NextResponse } from "next/server";
import { requireUser } from "@/lib/commerce/auth";
import { commerceEnv } from "@/lib/commerce/env";
import { localizePath, preferredLocale } from "@/lib/i18n/routing";

/** The redirect only displays webhook-created access. It never fulfils payment. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = preferredLocale(req.headers.get("cookie"));
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(localizePath(path, locale), url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const id = url.searchParams.get("session_id");
  if (!id) return redirect("/pricing");
  try {
    const env = await commerceEnv();
    const user = await requireUser(env, req);
    const licence = await env.COMMERCE_DB.prepare("SELECT id FROM licences WHERE checkout_session_id=? AND user_id=?").bind(id, user.id).first();
    return redirect(licence ? "/account?welcome=1" : "/account?pending=1");
  } catch {
    return redirect("/account?welcome=1");
  }
}
