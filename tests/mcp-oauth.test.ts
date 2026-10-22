import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { commerceFixture } from "./commerce-db";
import {
  accessTokenUser, accountLicence, checkAuthorization, disconnect, exchangeToken, issueCode, listConnections,
  redirectAllowed, redirectMatches, registerClient, revokeToken,
} from "@/lib/commerce/oauth";

const ORIGIN = "https://design.example.invalid";
const REDIRECT = "http://localhost:33418/callback";

function setup() {
  const f = commerceFixture();
  f.sql.prepare("INSERT INTO users(id, email, created_at) VALUES ('user-1', 'person@example.invalid', 0)").run();
  return f;
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
}

const query = (values: Record<string, string>) => new URLSearchParams(values);
const form = (values: Record<string, string>) => new URLSearchParams(values);

async function authorize(f: ReturnType<typeof setup>, extra: Record<string, unknown> = {}) {
  const client = await registerClient(f.env, { client_name: "Claude Code", redirect_uris: [REDIRECT], ...extra }, "fixture-ip");
  const { verifier, challenge } = pkce();
  const check = await checkAuthorization(f.env, ORIGIN, query({
    response_type: "code", client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: challenge,
    code_challenge_method: "S256", state: "opaque-state", resource: `${ORIGIN}/mcp/pro`, scope: "mcp",
  }));
  if (!check.ok) throw new Error(JSON.stringify(check));
  const location = new URL(await issueCode(f.env, { id: "user-1" }, check.request));
  expect(location.searchParams.get("state")).toBe("opaque-state");
  return { client, verifier, code: location.searchParams.get("code")! };
}

describe("MCP OAuth", () => {
  it("accepts HTTPS, loopback and app-scheme redirects only", () => {
    for (const ok of ["https://claude.ai/api/mcp/auth_callback", REDIRECT, "http://127.0.0.1:5000/cb", "cursor://anysphere.cursor-mcp/oauth/callback", "vscode://vscode.github-authentication/did-authenticate"]) expect(redirectAllowed(ok)).toBe(true);
    for (const bad of ["http://evil.example/cb", "javascript:alert(1)", "data:text/html,x", "https://x.example/cb#frag", "not a url", 42]) expect(redirectAllowed(bad)).toBe(false);
    expect(redirectMatches([REDIRECT], "http://localhost:51000/callback")).toBe(true);
    expect(redirectMatches([REDIRECT], "http://localhost:51000/other")).toBe(false);
    expect(redirectMatches(["https://claude.ai/cb"], "https://claude.ai/cb2")).toBe(false);
  });

  it("rejects unsafe registrations", async () => {
    const f = setup();
    await expect(registerClient(f.env, { redirect_uris: ["http://evil.example/cb"] }, "ip")).rejects.toMatchObject({ code: "invalid_redirect_uri" });
    await expect(registerClient(f.env, { redirect_uris: [] }, "ip")).rejects.toMatchObject({ code: "invalid_redirect_uri" });
    await expect(registerClient(f.env, { redirect_uris: [REDIRECT], grant_types: ["client_credentials"] }, "ip")).rejects.toMatchObject({ code: "invalid_client_metadata" });
    const named = await registerClient(f.env, { redirect_uris: [REDIRECT], client_name: "<b>Bad\u0000 name</b>" }, "ip");
    expect(named.client_name).toBe("bBad name/b");
    expect(named).not.toHaveProperty("client_secret");
    f.sql.close();
  });

  it("shows client problems on the page and returns protocol problems to the client", async () => {
    const f = setup();
    const client = await registerClient(f.env, { redirect_uris: [REDIRECT] }, "ip");
    const { challenge } = pkce();
    const base = { response_type: "code", client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: "s" };
    expect(await checkAuthorization(f.env, ORIGIN, query({ ...base, client_id: "unknown" }))).toMatchObject({ ok: false, fatal: expect.any(String) });
    expect(await checkAuthorization(f.env, ORIGIN, query({ ...base, redirect_uri: "https://attacker.example/cb" }))).toMatchObject({ ok: false, fatal: expect.any(String) });
    const noPkce = await checkAuthorization(f.env, ORIGIN, query({ ...base, code_challenge_method: "plain" }));
    expect(noPkce.ok || "fatal" in noPkce ? null : new URL(noPkce.redirect).searchParams.get("error")).toBe("invalid_request");
    const foreign = await checkAuthorization(f.env, ORIGIN, query({ ...base, resource: "https://other.example/mcp" }));
    expect(foreign.ok || "fatal" in foreign ? null : new URL(foreign.redirect).searchParams.get("state")).toBe("s");
    expect((await checkAuthorization(f.env, ORIGIN, query({ ...base, resource: `${ORIGIN}/mcp/` }))).ok).toBe(true);
    f.sql.close();
  });

  it("issues tokens once, for the right verifier, and resolves paid access from billing state", async () => {
    const f = setup();
    const { client, verifier, code } = await authorize(f);
    const wrong = pkce().verifier;
    await expect(exchangeToken(f.env, ORIGIN, form({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: wrong, redirect_uri: REDIRECT }), null)).rejects.toMatchObject({ code: "invalid_grant" });

    const { code: second, verifier: secondVerifier, client: secondClient } = await authorize(f);
    await expect(exchangeToken(f.env, ORIGIN, form({ grant_type: "authorization_code", client_id: client.client_id, code: second, code_verifier: secondVerifier }), null)).rejects.toMatchObject({ code: "invalid_grant" });
    expect(secondClient.client_id).not.toBe(client.client_id);

    const { code: third, verifier: thirdVerifier, client: thirdClient } = await authorize(f);
    const tokens = await exchangeToken(f.env, ORIGIN, form({ grant_type: "authorization_code", client_id: thirdClient.client_id, code: third, code_verifier: thirdVerifier, redirect_uri: REDIRECT, resource: `${ORIGIN}/mcp/pro` }), null);
    expect(tokens).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "mcp" });
    expect(tokens.access_token).toMatch(/^dfa_at_/);
    expect(JSON.stringify(f.sql.prepare("SELECT * FROM oauth_grants").all())).not.toContain(tokens.access_token);

    const user = await accessTokenUser(f.env, tokens.access_token);
    expect(user?.email).toBe("person@example.invalid");
    expect(await accountLicence(f.env, user!)).toMatchObject({ ok: false, reason: "missing" });
    f.sql.prepare("INSERT INTO licences(id,user_id,checkout_session_id,stripe_customer_id,plan,seats,status,created_at,updated_at) VALUES ('lic-1','user-1','cs','cus','pro-lifetime',1,'active',0,0)").run();
    expect(await accountLicence(f.env, user!)).toMatchObject({ ok: true, license: { id: "lic-1", plan: "pro-lifetime" } });

    // Replaying a redeemed code revokes the connection it created.
    await expect(exchangeToken(f.env, ORIGIN, form({ grant_type: "authorization_code", client_id: thirdClient.client_id, code: third, code_verifier: thirdVerifier }), null)).rejects.toMatchObject({ code: "invalid_grant" });
    expect(await accessTokenUser(f.env, tokens.access_token)).toBeNull();
    expect(verifier).not.toBe(thirdVerifier);
    f.sql.close();
  });

  it("rotates refresh tokens and ends the connection when an old one is replayed", async () => {
    const f = setup();
    const { client, verifier, code } = await authorize(f);
    const first = await exchangeToken(f.env, ORIGIN, form({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier }), null);
    const second = await exchangeToken(f.env, ORIGIN, form({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: first.refresh_token }), null);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(await accessTokenUser(f.env, first.access_token)).toBeNull();
    expect(await accessTokenUser(f.env, second.access_token)).not.toBeNull();
    await expect(exchangeToken(f.env, ORIGIN, form({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: first.refresh_token }), null)).rejects.toMatchObject({ code: "invalid_grant" });
    expect(await accessTokenUser(f.env, second.access_token)).toBeNull();
    expect(await listConnections(f.env, { id: "user-1" })).toEqual([]);
    f.sql.close();
  });

  it("authenticates confidential clients, revokes tokens and lets the account disconnect", async () => {
    const f = setup();
    const { client, verifier, code } = await authorize(f, { token_endpoint_auth_method: "client_secret_basic" });
    expect(client.client_secret).toBeTruthy();
    const params = { grant_type: "authorization_code", code, code_verifier: verifier };
    await expect(exchangeToken(f.env, ORIGIN, form({ ...params, client_id: client.client_id }), null)).rejects.toMatchObject({ code: "invalid_client", status: 401 });
    const basic = `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64")}`;
    const tokens = await exchangeToken(f.env, ORIGIN, form(params), basic);
    const [connection] = await listConnections(f.env, { id: "user-1" });
    expect(connection).toMatchObject({ name: "Claude Code" });
    await revokeToken(f.env, form({ token: tokens.refresh_token }), basic);
    expect(await accessTokenUser(f.env, tokens.access_token)).toBeNull();

    const again = await authorize(f);
    const more = await exchangeToken(f.env, ORIGIN, form({ grant_type: "authorization_code", client_id: again.client.client_id, code: again.code, code_verifier: again.verifier }), null);
    const [current] = await listConnections(f.env, { id: "user-1" });
    await disconnect(f.env, { id: "someone-else" }, current.id);
    expect(await accessTokenUser(f.env, more.access_token)).not.toBeNull();
    await disconnect(f.env, { id: "user-1" }, current.id);
    expect(await accessTokenUser(f.env, more.access_token)).toBeNull();
    f.sql.close();
  });

  it("rejects expired codes and fails closed before the migration is applied", async () => {
    const f = setup();
    const { client, verifier, code } = await authorize(f);
    f.sql.prepare("UPDATE oauth_codes SET expires_at=0").run();
    await expect(exchangeToken(f.env, ORIGIN, form({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier }), null)).rejects.toMatchObject({ code: "invalid_grant" });
    f.sql.exec("DROP TABLE oauth_codes; DROP TABLE oauth_grants; DROP TABLE oauth_clients;");
    await expect(registerClient(f.env, { redirect_uris: [REDIRECT] }, "ip")).rejects.toMatchObject({ status: 503 });
    expect(await accessTokenUser(f.env, "dfa_at_anything")).toBeNull();
    expect(await listConnections(f.env, { id: "user-1" })).toEqual([]);
    f.sql.close();
  });
});
