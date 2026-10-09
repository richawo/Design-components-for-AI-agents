import "server-only";
import crypto from "node:crypto";
import type { CommerceEnv } from "./env";
import { CommerceError } from "./env";
import { sendMail } from "./mail";

export const SESSION_COOKIE = "dfa_session";
const SESSION_MS = 30 * 86400_000;
const CODE_MS = 15 * 60_000;
export type AccountUser = { id: string; email: string; stripe_customer_id: string | null };

export function normalizedEmail(value: unknown) {
  if (typeof value !== "string") throw new CommerceError(400, "Enter your email address.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommerceError(400, "Enter a valid email address.");
  return email;
}

export const digest = (value: string, secret: string) => crypto.createHmac("sha256", secret).update(value).digest("hex");

export async function rateLimit(env: CommerceEnv, key: string, max: number, periodMs = 3600_000) {
  const window = Math.floor(Date.now() / periodMs);
  const row = await env.COMMERCE_DB.prepare(
    "INSERT INTO rate_limits(key, window, count) VALUES (?, ?, 1) ON CONFLICT(key, window) DO UPDATE SET count=count+1 RETURNING count",
  ).bind(digest(key, env.AUTH_SECRET), window).first<{ count: number }>();
  if (!row || row.count > max) throw new CommerceError(429, "Too many attempts. Please try again later.");
}

export async function requestEmailCode(env: CommerceEnv, email: string, ip: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new CommerceError(503, "Email sign-in is temporarily unavailable. Please try again shortly.");
  await rateLimit(env, `send-ip:${ip}`, 15);
  await rateLimit(env, `send-email:${email}`, 6);
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const id = crypto.randomUUID();
  const now = Date.now();
  const saved = await env.COMMERCE_DB.prepare(
    `INSERT INTO email_login_codes(email, id, code_hash, issued_at, expires_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET id=excluded.id, code_hash=excluded.code_hash,
     issued_at=excluded.issued_at, expires_at=excluded.expires_at, attempts=0, consumed_at=NULL
     WHERE email_login_codes.issued_at <= ? RETURNING id`,
  ).bind(email, id, digest(`${email}:${code}`, env.AUTH_SECRET), now, now + CODE_MS, now - 30_000).first();
  if (!saved) throw new CommerceError(429, "A code was just sent. Wait 30 seconds before requesting another.");
  try {
    await sendMail(env, {
      to: email, subject: "Your Design for AI sign-in code", idempotencyKey: `signin/${id}`,
      title: "Your sign-in code", text: `Enter ${code} to sign in to Design for AI. This code expires in 15 minutes. If you did not request it, you can ignore this email.`,
      code,
    });
  } catch (error) {
    await env.COMMERCE_DB.prepare("DELETE FROM email_login_codes WHERE email=? AND id=?").bind(email, id).run();
    throw error;
  }
  return { success: true, expiresIn: CODE_MS / 1000 };
}

export async function verifyEmailCode(env: CommerceEnv, email: string, code: unknown, ip: string) {
  await rateLimit(env, `verify-ip:${ip}`, 40);
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new CommerceError(400, "Enter the six-digit code from your email.");
  const hash = digest(`${email}:${code}`, env.AUTH_SECRET);
  const now = Date.now();
  // Comparison and consumption are one write, so concurrent verification can only succeed once.
  const result = await env.COMMERCE_DB.prepare(
    `UPDATE email_login_codes SET attempts=attempts+1,
     consumed_at=CASE WHEN code_hash=? THEN ? ELSE NULL END
     WHERE email=? AND expires_at>? AND consumed_at IS NULL AND attempts<5
     RETURNING code_hash, consumed_at`,
  ).bind(hash, now, email, now).first<{ code_hash: string; consumed_at: number | null }>();
  if (!result?.consumed_at || result.code_hash !== hash) throw new CommerceError(401, "That code is invalid, expired or already used. Request a new code if needed.");
  const user = await env.COMMERCE_DB.prepare(
    "INSERT INTO users(id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id, email, stripe_customer_id",
  ).bind(crypto.randomUUID(), email, now).first<AccountUser>();
  if (!user) throw new Error("Account creation failed");
  const token = crypto.randomBytes(32).toString("base64url");
  await env.COMMERCE_DB.prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(digest(token, env.AUTH_SECRET), user.id, now + SESSION_MS).run();
  return { user, token };
}

export function cookieValue(req: Request, name: string) {
  return (req.headers.get("cookie") ?? "").split(/;\s*/).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

export async function sessionUser(env: CommerceEnv, req: Request): Promise<AccountUser | null> {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  return env.COMMERCE_DB.prepare(
    "SELECT u.id, u.email, u.stripe_customer_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
  ).bind(digest(token, env.AUTH_SECRET), Date.now()).first<AccountUser>();
}

export async function requireUser(env: CommerceEnv, req: Request) {
  const user = await sessionUser(env, req);
  if (!user) throw new CommerceError(401, "Sign in to continue.");
  return user;
}

export function sessionCookie(token: string, req: Request, expired = false) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: expired ? 0 : SESSION_MS / 1000 };
}

export async function logoutSession(env: CommerceEnv, req: Request) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (token) await env.COMMERCE_DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(digest(token, env.AUTH_SECRET)).run();
}
