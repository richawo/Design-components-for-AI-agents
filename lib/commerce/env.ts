import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

export type CommerceEnv = {
  COMMERCE_DB: D1Database;
  AUTH_SECRET: string;
  LICENSE_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PORTAL_CONFIGURATION?: string;
  STRIPE_AUTOMATIC_TAX?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  STRIPE_PRICE_PRO_YEARLY?: string;
  STRIPE_PRICE_PRO_LIFETIME?: string;
  STRIPE_PRICE_TEAM_YEARLY?: string;
  STRIPE_PRICE_TEAM_LIFETIME?: string;
};

export async function commerceEnv(): Promise<CommerceEnv> {
  const { env } = await getCloudflareContext({ async: true });
  const value = env as unknown as CommerceEnv;
  if (!value.COMMERCE_DB || !value.AUTH_SECRET || value.AUTH_SECRET.length < 32) {
    throw new CommerceError(503, "Accounts are temporarily unavailable. Please try again shortly.");
  }
  return value;
}

export class CommerceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const privateJson = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store", ...headers } });

export function commerceFailure(error: unknown) {
  if (error instanceof CommerceError) return privateJson({ error: error.message }, error.status);
  // Do not log request bodies, email addresses, codes, credentials or provider responses.
  console.error("commerce: request failed");
  return privateJson({ error: "Something went wrong. Please try again shortly." }, 503);
}

export function requireSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new CommerceError(403, "Please make this request from the account page.");
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new CommerceError(415, "A JSON request is required.");
}
