import { NextResponse } from "next/server";
import { LICENSE_COOKIE } from "@/lib/license";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(LICENSE_COOKIE);
  return res;
}
