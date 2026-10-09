import "server-only";
import crypto from "node:crypto";

/**
 * Licence keys are self-contained, signed tokens:
 *
 *   dfa_<base64url(payload)>.<base64url(hmac-sha256(payload, LICENSE_SECRET))>
 *
 * Version 1 manual keys carry their original expiry. Version 2 account keys
 * additionally require a live commerce database check for paid access and
 * team membership. Their signed identity survives a yearly renewal, so CLI
 * and MCP clients do not need to rotate a key each year.
 */

export type Plan = "pro-yearly" | "pro-lifetime" | "team-yearly" | "team-lifetime";

export type LicensePayload = {
  v: 1 | 2;
  id: string;
  email: string;
  plan: Plan;
  seats: number;
  iat: number;
  /** Seconds since epoch; null for lifetime plans. */
  exp: number | null;
  /** Stripe subscription id for yearly plans. */
  subId?: string;
  /** Version 2 keys are bound to a recoverable account and checked against billing state. */
  userId?: string;
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

export function signLicense(p: Omit<LicensePayload, "v" | "id" | "iat"> & { id?: string; iat?: number }, version: 1 | 2 = 1): string {
  const payload: LicensePayload = { v: version, id: p.id ?? crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), ...p } as LicensePayload;
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
  if (!license || ![1, 2].includes(license.v) || typeof license.id !== "string" || typeof license.email !== "string" ||
      !["pro-yearly", "pro-lifetime", "team-yearly", "team-lifetime"].includes(license.plan) ||
      !Number.isInteger(license.seats) || license.seats < 1 || !Number.isFinite(license.iat) ||
      (license.exp !== null && !Number.isFinite(license.exp)) || (license.v === 2 && typeof license.userId !== "string")) {
    return { ok: false, reason: "malformed" };
  }
  const revoked = (process.env.LICENSE_REVOKED ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (revoked.includes(license.id)) return { ok: false, reason: "revoked", license };
  if (license.exp !== null && license.exp * 1000 <= Date.now()) return { ok: false, reason: "expired", license };
  return { ok: true, license };
}

/** Reads a licence from `Authorization: Bearer …` or the licence cookie. */
export function licenseFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const cookie = req.headers.get("cookie") ?? "";
  const hit = cookie.split(/;\s*/).find((c) => c.startsWith(`${LICENSE_COOKIE}=`));
  if (!hit) return null;
  try { return decodeURIComponent(hit.slice(LICENSE_COOKIE.length + 1)); }
  catch { return "invalid-cookie"; }
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

export const unauthorized = (reason: string) =>
  Response.json(
    { error: "A Design for AI Pro licence is required.", reason, get: "https://design.yaps.ai/pricing" },
    { status: reason === "missing" ? 401 : 403, headers: { "Cache-Control": "no-store" } },
  );
