import "server-only";
import crypto from "node:crypto";
import type { Verified } from "@/lib/license";
import { site } from "@/lib/site";
import { digest, rateLimit, type AccountUser } from "./auth";
import { CommerceError, type CommerceEnv } from "./env";
import { accountLicences, activeLicence, licencePayload } from "./licences";

/**
 * OAuth 2.1 for the signed-in MCP endpoint (/mcp/pro), following the MCP
 * authorization spec: protected-resource metadata (RFC 9728), authorization
 * server metadata (RFC 8414), dynamic client registration (RFC 7591), PKCE
 * (S256 only), resource indicators (RFC 8707) and revocation (RFC 7009).
 *
 * Users approve a client with the same email-code account the site uses, so
 * no licence key is copied into an MCP configuration. Tokens are opaque,
 * stored only as digests, and grant MCP access only: the REST registry and
 * source APIs keep accepting licence keys, never these tokens. Paid access is
 * resolved from billing state on every request, exactly like a session.
 */

export const ACCESS_PREFIX = "dfa_at_";
export const REFRESH_PREFIX = "dfa_rt_";
export const MCP_SCOPE = "mcp";
export const MCP_RESOURCE_PATHS = ["/mcp/pro", "/mcp"];
const CODE_MS = 5 * 60_000;
const ACCESS_MS = 3600_000;
const REFRESH_MS = 90 * 86400_000;
const TOUCH_MS = 10 * 60_000;

export class OAuthError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

export type OAuthClient = { id: string; name: string; redirect_uris: string; secret_hash: string | null; created_at: number };
export type AuthorizationRequest = { client: OAuthClient; redirectUri: string; state: string | null; challenge: string; scope: string };
export type Connection = { id: string; name: string; created_at: number; last_used_at: number };

/**
 * The canonical origin is the issuer and resource identity everywhere. Request
 * URLs are not used: behind the Worker router they can carry the route host or
 * scheme, and clients require the challenge, metadata and token audience to agree.
 */
export const oauthOrigin = () => new URL(site.url).origin;

const token = (prefix = "") => prefix + crypto.randomBytes(32).toString("base64url");
const missingSchema = (error: unknown) => error instanceof Error && /no such table: oauth_/.test(error.message);

/** Until migration 0004 is applied, agent sign-in fails closed with a clear message; nothing else is affected. */
export async function withOAuthSchema<T>(task: () => Promise<T>): Promise<T> {
  try { return await task(); } catch (error) {
    if (missingSchema(error)) throw new CommerceError(503, "Agent sign-in is being set up. Please try again shortly, or use your licence key for now.");
    throw error;
  }
}

export function authorizationServerMetadata(origin: string) {
  const methods = ["none", "client_secret_post", "client_secret_basic"];
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: methods,
    revocation_endpoint_auth_methods_supported: methods,
    scopes_supported: [MCP_SCOPE],
    service_documentation: `${origin}/docs/agents`,
  };
}

export function protectedResourceMetadata(origin: string, path = "/mcp/pro") {
  return {
    resource: `${origin}${path}`,
    authorization_servers: [origin],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Design for AI",
    resource_documentation: `${origin}/docs/agents`,
  };
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:"]);

/** HTTPS, loopback HTTP for local clients, or a private-use scheme for desktop apps (RFC 8252). */
export function redirectAllowed(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && !BLOCKED_SCHEMES.has(url.protocol);
}

/** Exact match, except that loopback redirects may use any port (RFC 8252 §7.3). */
export function redirectMatches(registered: string[], given: string) {
  if (registered.includes(given)) return true;
  let url: URL;
  try { url = new URL(given); } catch { return false; }
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) return false;
  return registered.some((value) => {
    const known = new URL(value);
    return known.protocol === "http:" && known.hostname === url.hostname && known.pathname === url.pathname && known.search === url.search;
  });
}

export function resourceAllowed(origin: string, resource: string | null) {
  if (!resource) return true;
  const clean = resource.replace(/\/+$/, "");
  return MCP_RESOURCE_PATHS.some((path) => clean === `${origin}${path}`);
}

const cleanName = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) : "";

export async function registerClient(env: CommerceEnv, body: Record<string, unknown>, ip: string) {
  await rateLimit(env, `oauth-register:${ip}`, 30);
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every(redirectAllowed)) {
    throw new OAuthError("invalid_redirect_uri", "Register one to ten HTTPS, loopback or app-scheme redirect URIs.");
  }
  const grants = body.grant_types;
  if (grants !== undefined && (!Array.isArray(grants) || !grants.includes("authorization_code"))) {
    throw new OAuthError("invalid_client_metadata", "Only the authorization_code grant (with refresh_token) is supported.");
  }
  const method = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) {
    throw new OAuthError("invalid_client_metadata", "Unsupported token_endpoint_auth_method.");
  }
  const id = crypto.randomUUID();
  const secret = method === "none" ? null : token();
  const name = cleanName(body.client_name) || "MCP client";
  const now = Date.now();
  await withOAuthSchema(() => env.COMMERCE_DB.prepare("INSERT INTO oauth_clients(id, name, redirect_uris, secret_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, name, JSON.stringify(uris), secret ? digest(secret, env.AUTH_SECRET) : null, now).run());
  return {
    client_id: id, client_id_issued_at: Math.floor(now / 1000), client_name: name, redirect_uris: uris,
    grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: method,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
  };
}

async function findClient(env: CommerceEnv, id: string | null) {
  if (!id || id.length > 100) return null;
  return withOAuthSchema(() => env.COMMERCE_DB.prepare("SELECT * FROM oauth_clients WHERE id=?").bind(id).first<OAuthClient>());
}

export type AuthorizationCheck =
  | { ok: true; request: AuthorizationRequest }
  | { ok: false; fatal: string }
  | { ok: false; redirect: string };

export function errorRedirect(redirectUri: string, state: string | null, error: string, description?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  if (state !== null) url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Validates an authorization request. Problems with the client or redirect URI
 * are shown on our page and never redirected (RFC 6749 §4.1.2.1); everything
 * else is returned to the client as an error redirect.
 */
export async function checkAuthorization(env: CommerceEnv, origin: string, params: URLSearchParams): Promise<AuthorizationCheck> {
  const single = (key: string) => { const values = params.getAll(key); return values.length === 1 ? values[0] : values.length ? undefined : null; };
  const clientId = single("client_id");
  const client = await findClient(env, clientId ?? null);
  if (!client) return { ok: false, fatal: "This app isn't registered with Design for AI. Remove the server from your agent and add it again." };
  const redirectUri = single("redirect_uri");
  const registered = JSON.parse(client.redirect_uris) as string[];
  const resolved = redirectUri ?? (registered.length === 1 ? registered[0] : undefined);
  if (!resolved || !redirectMatches(registered, resolved)) return { ok: false, fatal: "The app asked to return to an address it didn't register. Nothing was shared." };
  const state = single("state") ?? null;
  const fail = (error: string, description: string) => ({ ok: false as const, redirect: errorRedirect(resolved, state, error, description) });
  if (single("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  const challenge = single("code_challenge");
  if (!challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge) || single("code_challenge_method") !== "S256") return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  const resource = single("resource");
  if (resource === undefined || !resourceAllowed(origin, resource)) return fail("invalid_target", "Unknown resource.");
  return { ok: true, request: { client, redirectUri: resolved, state, challenge, scope: MCP_SCOPE } };
}

export async function issueCode(env: CommerceEnv, user: Pick<AccountUser, "id">, request: AuthorizationRequest) {
  const code = token();
  const now = Date.now();
  await withOAuthSchema(async () => {
    await env.COMMERCE_DB.prepare("DELETE FROM oauth_codes WHERE expires_at<?").bind(now - 86400_000).run();
    await env.COMMERCE_DB.prepare("INSERT INTO oauth_codes(code_hash, client_id, user_id, redirect_uri, code_challenge, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(digest(code, env.AUTH_SECRET), request.client.id, user.id, request.redirectUri, request.challenge, request.scope, now + CODE_MS).run();
  });
  const url = new URL(request.redirectUri);
  url.searchParams.set("code", code);
  if (request.state !== null) url.searchParams.set("state", request.state);
  return url.toString();
}

const pkce = (verifier: string) => crypto.createHash("sha256").update(verifier).digest("base64url");
const sameSecret = (given: string, hash: string, env: CommerceEnv) => {
  const a = Buffer.from(digest(given, env.AUTH_SECRET)), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Client authentication: public clients send client_id; confidential clients also prove their secret. */
export async function authenticateClient(env: CommerceEnv, form: URLSearchParams, authorization: string | null) {
  let id = form.get("client_id"), secret = form.get("client_secret");
  if (authorization?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(authorization.slice(6).trim(), "base64").toString("utf8");
    const split = decoded.indexOf(":");
    if (split > 0) { id = decodeURIComponent(decoded.slice(0, split)); secret = decodeURIComponent(decoded.slice(split + 1)); }
  }
  const client = await findClient(env, id);
  if (!client) throw new OAuthError("invalid_client", "Unknown client.", 401);
  if (client.secret_hash && (!secret || !sameSecret(secret, client.secret_hash, env))) throw new OAuthError("invalid_client", "Client authentication failed.", 401);
  return client;
}

function tokenResponse(access: string, refresh: string, scope: string) {
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_MS / 1000, refresh_token: refresh, scope };
}

export async function exchangeToken(env: CommerceEnv, origin: string, form: URLSearchParams, authorization: string | null) {
  const client = await authenticateClient(env, form, authorization);
  if (!resourceAllowed(origin, form.get("resource"))) throw new OAuthError("invalid_target", "Unknown resource.");
  const grant = form.get("grant_type");
  const now = Date.now();
  const access = token(ACCESS_PREFIX), refresh = token(REFRESH_PREFIX);
  const accessHash = digest(access, env.AUTH_SECRET), refreshHash = digest(refresh, env.AUTH_SECRET);

  if (grant === "authorization_code") {
    const code = form.get("code"), verifier = form.get("code_verifier");
    if (!code || !verifier) throw new OAuthError("invalid_request", "code and code_verifier are required.");
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new OAuthError("invalid_grant", "Invalid code_verifier.");
    const codeHash = digest(code, env.AUTH_SECRET);
    // Comparison and consumption are one write, so a code can only be redeemed once.
    const row = await withOAuthSchema(() => env.COMMERCE_DB.prepare(
      "UPDATE oauth_codes SET consumed_at=? WHERE code_hash=? AND consumed_at IS NULL AND expires_at>? RETURNING *",
    ).bind(now, codeHash, now).first<{ client_id: string; user_id: string; redirect_uri: string; code_challenge: string; scope: string }>());
    if (!row) {
      // A replayed code revokes whatever it already issued (RFC 6749 §4.1.2).
      await env.COMMERCE_DB.prepare("DELETE FROM oauth_grants WHERE id=(SELECT grant_id FROM oauth_codes WHERE code_hash=? AND consumed_at IS NOT NULL)").bind(codeHash).run();
      throw new OAuthError("invalid_grant", "The authorization code is invalid, expired or already used.");
    }
    const redirect = form.get("redirect_uri");
    if (row.client_id !== client.id || (redirect !== null && redirect !== row.redirect_uri) || pkce(verifier) !== row.code_challenge) {
      throw new OAuthError("invalid_grant", "The authorization code doesn't match this client, redirect URI or code_verifier.");
    }
    const id = crypto.randomUUID();
    await env.COMMERCE_DB.prepare(
      `INSERT INTO oauth_grants(id, client_id, user_id, scope, access_hash, access_expires_at, refresh_hash, refresh_expires_at, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, client.id, row.user_id, row.scope, accessHash, now + ACCESS_MS, refreshHash, now + REFRESH_MS, now, now).run();
    await env.COMMERCE_DB.prepare("UPDATE oauth_codes SET grant_id=? WHERE code_hash=?").bind(id, codeHash).run();
    return tokenResponse(access, refresh, row.scope);
  }

  if (grant === "refresh_token") {
    const presented = form.get("refresh_token");
    if (!presented) throw new OAuthError("invalid_request", "refresh_token is required.");
    const presentedHash = digest(presented, env.AUTH_SECRET);
    // Rotation: the presented token is replaced atomically and kept only to detect reuse.
    const row = await withOAuthSchema(() => env.COMMERCE_DB.prepare(
      `UPDATE oauth_grants SET access_hash=?, access_expires_at=?, refresh_hash=?, refresh_expires_at=?, previous_refresh_hash=refresh_hash, last_used_at=?
       WHERE refresh_hash=? AND client_id=? AND refresh_expires_at>? RETURNING scope`,
    ).bind(accessHash, now + ACCESS_MS, refreshHash, now + REFRESH_MS, now, presentedHash, client.id, now).first<{ scope: string }>());
    if (!row) {
      // A rotated-out refresh token being replayed means it leaked: end that connection.
      await env.COMMERCE_DB.prepare("DELETE FROM oauth_grants WHERE previous_refresh_hash=?").bind(presentedHash).run();
      throw new OAuthError("invalid_grant", "The refresh token is invalid, expired or revoked. Sign in again.");
    }
    return tokenResponse(access, refresh, row.scope);
  }

  throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

/** RFC 7009: revoking either token ends the whole connection. Unknown tokens succeed silently. */
export async function revokeToken(env: CommerceEnv, form: URLSearchParams, authorization: string | null) {
  const client = await authenticateClient(env, form, authorization);
  const value = form.get("token");
  if (!value) throw new OAuthError("invalid_request", "token is required.");
  const hash = digest(value, env.AUTH_SECRET);
  await withOAuthSchema(() => env.COMMERCE_DB.prepare("DELETE FROM oauth_grants WHERE client_id=? AND (access_hash=? OR refresh_hash=?)").bind(client.id, hash, hash).run());
}

/** The account behind an MCP access token, or null if it is unknown or expired. */
export async function accessTokenUser(env: CommerceEnv, value: string): Promise<AccountUser | null> {
  if (!value.startsWith(ACCESS_PREFIX) || value.length > 100) return null;
  const now = Date.now();
  let row: (AccountUser & { grant_id: string; last_used_at: number }) | null;
  try {
    row = await env.COMMERCE_DB.prepare(
      `SELECT u.id, u.email, u.stripe_customer_id, g.id AS grant_id, g.last_used_at FROM oauth_grants g JOIN users u ON u.id=g.user_id
       WHERE g.access_hash=? AND g.access_expires_at>?`,
    ).bind(digest(value, env.AUTH_SECRET), now).first();
  } catch (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
  if (!row) return null;
  if (now - row.last_used_at > TOUCH_MS) await env.COMMERCE_DB.prepare("UPDATE oauth_grants SET last_used_at=? WHERE id=?").bind(now, row.grant_id).run();
  return { id: row.id, email: row.email, stripe_customer_id: row.stripe_customer_id };
}

/** Paid access for a signed-in account, read from billing state like a browser session. */
export async function accountLicence(env: CommerceEnv, user: AccountUser): Promise<Verified> {
  const licence = (await accountLicences(env, user)).find(activeLicence);
  return licence ? { ok: true, license: { ...licencePayload(licence, user), v: 2 } } : { ok: false, reason: "missing" };
}

export async function listConnections(env: CommerceEnv, user: Pick<AccountUser, "id">): Promise<Connection[]> {
  try {
    const { results } = await env.COMMERCE_DB.prepare(
      `SELECT g.id, c.name, g.created_at, g.last_used_at FROM oauth_grants g JOIN oauth_clients c ON c.id=g.client_id
       WHERE g.user_id=? AND g.refresh_expires_at>? ORDER BY g.last_used_at DESC`,
    ).bind(user.id, Date.now()).all<Connection>();
    return results;
  } catch (error) {
    if (missingSchema(error)) return [];
    throw error;
  }
}

export async function disconnect(env: CommerceEnv, user: Pick<AccountUser, "id">, id: unknown) {
  if (typeof id !== "string" || id.length > 100) throw new CommerceError(400, "Choose a connection to remove.");
  await withOAuthSchema(() => env.COMMERCE_DB.prepare("DELETE FROM oauth_grants WHERE id=? AND user_id=?").bind(id, user.id).run());
}
