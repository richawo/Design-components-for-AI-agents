import "server-only";
import crypto from "node:crypto";

/**
 * Licence keys are self-contained, signed tokens:
 *
 *   dfa_<base64url(payload)>.<base64url(hmac-sha256(payload, LICENSE_SECRET))>
 *
 * No database is needed to verify one. Yearly plans carry an expiry and the
 * Stripe subscription id, so /api/license/me can renew them while the
 * subscription is active. Revoke a key by adding its `id` to LICENSE_REVOKED
 * (comma separated), or move to a KV store when that list grows.
 */

export type Plan = "pro-yearly" | "pro-lifetime" | "team-yearly" | "team-lifetime";

export type LicensePayload = {
  v: 1;
  id: string;
  email: string;
  plan: Plan;
  seats: number;
  iat: number;
  /** Seconds since epoch; null for lifetime plans. */
  exp: number | null;
  /** Stripe subscription id for yearly plans. */
  subId?: string;
};

export const LICENSE_COOKIE = "dfa_license";

function secret() {
  const s = process.env.LICENSE_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("LICENSE_SECRET must be set (32+ chars)");
    return "dev-only-secret-dev-only-secret-dev-only";
  }
  return s;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function signLicense(p: Omit<LicensePayload, "v" | "id" | "iat"> & { id?: string }): string {
  const payload: LicensePayload = { v: 1, id: p.id ?? crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), ...p } as LicensePayload;
  const body = b64(JSON.stringify(payload));
  const sig = b64(crypto.createHmac("sha256", secret()).update(body).digest());
  return `dfa_${body}.${sig}`;
}

export type Verified =
  | { ok: true; license: LicensePayload }
  | { ok: false; reason: "missing" | "malformed" | "signature" | "revoked" | "expired"; license?: LicensePayload };

export function verifyLicense(token: string | null | undefined): Verified {
  if (!token) return { ok: false, reason: "missing" };
  const m = /^dfa_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token.trim());
  if (!m) return { ok: false, reason: "malformed" };
  const [, body, sig] = m;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: "signature" };
  let license: LicensePayload;
  try {
    license = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const revoked = (process.env.LICENSE_REVOKED ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (revoked.includes(license.id)) return { ok: false, reason: "revoked", license };
  if (license.exp && license.exp * 1000 < Date.now()) return { ok: false, reason: "expired", license };
  return { ok: true, license };
}

/** Reads a licence from `Authorization: Bearer …` or the licence cookie. */
export function licenseFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const cookie = req.headers.get("cookie") ?? "";
  const hit = cookie.split(/;\s*/).find((c) => c.startsWith(`${LICENSE_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(LICENSE_COOKIE.length + 1)) : null;
}

export function licenseCookie(token: string) {
  return {
    name: LICENSE_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  };
}

export function requireLicense(req: Request): Verified {
  return verifyLicense(licenseFromRequest(req));
}

export const unauthorized = (reason: string) =>
  Response.json(
    { error: "A Design for AI Pro licence is required.", reason, get: "https://design.yaps.ai/pricing" },
    { status: reason === "missing" ? 401 : 403, headers: { "Cache-Control": "no-store" } },
  );
