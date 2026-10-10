import "server-only";
import { licenseFromRequest, signLicense, verifyLicense, type LicensePayload, type Verified } from "@/lib/license";
import { commerceEnv, type CommerceEnv } from "./env";
import { sessionUser, type AccountUser } from "./auth";
import type { LicenceRow } from "./billing";

export function activeLicence(row: LicenceRow) {
  return row.status === "active" && (row.expires_at === null || row.expires_at > Date.now() / 1000);
}

export function licencePayload(row: LicenceRow, user: Pick<AccountUser, "id" | "email">): Omit<LicensePayload, "v" | "iat"> & { iat: number } {
  return { id: row.id, email: user.email, userId: user.id, plan: row.plan, seats: row.seats, exp: row.expires_at, iat: Math.floor(row.created_at / 1000), ...(row.subscription_id ? { subId: row.subscription_id } : {}) };
}

export async function accountLicences(env: CommerceEnv, user: AccountUser) {
  const { results } = await env.COMMERCE_DB.prepare(
    `SELECT l.*, u.email AS owner_email FROM licences l JOIN users u ON u.id=l.user_id
     WHERE l.user_id=? OR (l.seats>1 AND EXISTS (SELECT 1 FROM team_members m WHERE m.licence_id=l.id AND m.email=? COLLATE NOCASE))
     ORDER BY l.created_at DESC`,
  ).bind(user.id, user.email).all<LicenceRow>();
  return results;
}

export async function ownsAccess(env: CommerceEnv, row: LicenceRow, userId: string, email: string) {
  const user = await env.COMMERCE_DB.prepare("SELECT id FROM users WHERE id=? AND email=? COLLATE NOCASE").bind(userId, email).first();
  if (!user) return false;
  if (row.user_id === userId) return true;
  if (row.seats < 2) return false;
  return Boolean(await env.COMMERCE_DB.prepare("SELECT 1 FROM team_members WHERE licence_id=? AND email=? COLLATE NOCASE").bind(row.id, email).first());
}

export async function verifiedStoredKey(env: CommerceEnv, token: string): Promise<Verified> {
  const parsed = verifyLicense(token);
  const payload = parsed.ok ? parsed.license : parsed.reason === "expired" ? parsed.license : undefined;
  if (!payload) return parsed;
  if (payload.v === 1) return parsed; // Previously issued manual keys keep their existing contract.
  const row = await env.COMMERCE_DB.prepare("SELECT * FROM licences WHERE id=?").bind(payload.id).first<LicenceRow>();
  if (!row || !payload.userId || !(await ownsAccess(env, row, payload.userId, payload.email))) return { ok: false, reason: "revoked" };
  if (!activeLicence(row)) return { ok: false, reason: row.status === "active" ? "expired" : "revoked" };
  return { ok: true, license: { ...licencePayload(row, { id: payload.userId, email: payload.email }), v: 2 } };
}

export async function requireCommerceLicense(req: Request): Promise<Verified> {
  const token = licenseFromRequest(req);
  if (token) {
    const parsed = verifyLicense(token);
    const payload = parsed.ok ? parsed.license : parsed.license;
    if (!payload || payload.v === 1) return parsed;
    return verifiedStoredKey(await commerceEnv(), token);
  }
  if (!req.headers.get("cookie")?.includes("dfa_session=")) return { ok: false, reason: "missing" };
  const env = await commerceEnv();
  const user = await sessionUser(env, req);
  if (!user) return { ok: false, reason: "missing" };
  const licence = (await accountLicences(env, user)).find(activeLicence);
  return licence ? { ok: true, license: { ...licencePayload(licence, user), v: 2 } } : { ok: false, reason: "missing" };
}

export async function accountDetails(env: CommerceEnv, user: AccountUser) {
  const rows = await accountLicences(env, user);
  const pending = await env.COMMERCE_DB.prepare("SELECT id FROM checkout_requests WHERE user_id=? AND session_id IS NOT NULL").bind(user.id).first();
  return { user: { id: user.id, email: user.email }, hasBilling: Boolean(user.stripe_customer_id), pendingCheckout: Boolean(pending), licences: await Promise.all(rows.map(async (row) => ({
    id: row.id, plan: row.plan, seats: row.seats, status: row.status, expiresAt: row.expires_at,
    owner: row.user_id === user.id, active: activeLicence(row),
    token: activeLicence(row) ? signLicense(licencePayload(row, user), 2) : null,
    members: row.user_id === user.id && row.seats > 1 ? (await env.COMMERCE_DB.prepare("SELECT email, invitation_sent_at FROM team_members WHERE licence_id=? ORDER BY created_at")
      .bind(row.id).all<{ email: string; invitation_sent_at: number | null }>()).results : [],
  }))) };
}
