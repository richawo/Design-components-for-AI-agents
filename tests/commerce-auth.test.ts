import { afterEach, describe, expect, it, vi } from "vitest";
import { commerceFixture } from "./commerce-db";
import { digest, logoutSession, normalizedEmail, requestEmailCode, sessionUser, verifyEmailCode } from "@/lib/commerce/auth";
import { requireSameOrigin } from "@/lib/commerce/env";

afterEach(() => vi.restoreAllMocks());

function mailCapture() {
  let code = "";
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    const mail = JSON.parse(String(init.body));
    code = /Enter (\d{6})/.exec(mail.text)![1];
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, code: () => code };
}

describe("email-code accounts", () => {
  it("creates a recoverable account and a hashed session; a code cannot be replayed", async () => {
    const { env, sql } = commerceFixture();
    const mail = mailCapture();
    const email = normalizedEmail(" Person@Example.Invalid ");
    const issued = await requestEmailCode(env, email, "fixture-ip");
    expect(issued).not.toHaveProperty("code");
    const stored = sql.prepare("SELECT * FROM email_login_codes").get()!;
    expect(stored.code_hash).not.toBe(mail.code());
    const { user, token } = await verifyEmailCode(env, email, mail.code(), "fixture-ip");
    expect(sql.prepare("SELECT token_hash FROM sessions").get()!.token_hash).toBe(digest(token, env.AUTH_SECRET));
    const req = new Request("https://example.invalid/api/account", { headers: { Cookie: `dfa_session=${token}` } });
    expect((await sessionUser(env, req))?.id).toBe(user.id);
    await expect(verifyEmailCode(env, email, mail.code(), "fixture-ip")).rejects.toMatchObject({ status: 401 });
    await logoutSession(env, req);
    expect(await sessionUser(env, req)).toBeNull();
    sql.close();
  });

  it("allows only five guesses and enforces resend cooldown without replacing the valid code", async () => {
    const { env, sql } = commerceFixture();
    const mail = mailCapture();
    await requestEmailCode(env, "person@example.invalid", "fixture-ip");
    const original = sql.prepare("SELECT id FROM email_login_codes").get()!.id;
    await expect(requestEmailCode(env, "person@example.invalid", "fixture-ip")).rejects.toMatchObject({ status: 429 });
    expect(sql.prepare("SELECT id FROM email_login_codes").get()!.id).toBe(original);
    const wrong = mail.code() === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(verifyEmailCode(env, "person@example.invalid", wrong, "fixture-ip")).rejects.toMatchObject({ status: 401 });
    await expect(verifyEmailCode(env, "person@example.invalid", mail.code(), "fixture-ip")).rejects.toMatchObject({ status: 401 });
    sql.close();
  });

  it("rejects expired codes and does not report success when the email provider fails", async () => {
    const { env, sql } = commerceFixture();
    const mail = mailCapture();
    await requestEmailCode(env, "person@example.invalid", "fixture-ip");
    sql.prepare("UPDATE email_login_codes SET expires_at=0").run();
    await expect(verifyEmailCode(env, "person@example.invalid", mail.code(), "fixture-ip")).rejects.toMatchObject({ status: 401 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{}', { status: 500 })));
    await expect(requestEmailCode(env, "other@example.invalid", "other-ip")).rejects.toMatchObject({ status: 503 });
    expect(sql.prepare("SELECT * FROM email_login_codes WHERE email=?").get("other@example.invalid")).toBeUndefined();
    sql.close();
  });

  it("rejects cross-origin and form requests before they can modify accounts", () => {
    expect(() => requireSameOrigin(new Request("https://example.invalid/api/auth/request", { headers: { Origin: "https://other.invalid", "Content-Type": "application/json" } }))).toThrow();
    expect(() => requireSameOrigin(new Request("https://example.invalid/api/auth/request", { headers: { "Content-Type": "application/x-www-form-urlencoded" } }))).toThrow();
    expect(() => requireSameOrigin(new Request("https://example.invalid/api/auth/request", { headers: { Origin: "https://example.invalid", "Content-Type": "application/json" } }))).not.toThrow();
  });
});
