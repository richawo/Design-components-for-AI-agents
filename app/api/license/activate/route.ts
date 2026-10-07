import { NextResponse } from "next/server";
import { licenseCookie, verifyLicense } from "@/lib/license";

/** Paste a licence key on a new device. */
export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  const v = verifyLicense(token);
  if (!v.ok) return NextResponse.json({ active: false, reason: v.reason }, { status: 400 });
  const res = NextResponse.json({ active: true, license: v.license });
  res.cookies.set(licenseCookie(token!.trim()));
  return res;
}
