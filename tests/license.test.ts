import { afterEach, describe, expect, it } from "vitest";
import { licenseFromRequest, signLicense, verifyLicense } from "@/lib/license";

const base = { email: "ada@example.com", plan: "pro-lifetime" as const, seats: 1, exp: null };

describe("licence tokens", () => {
  afterEach(() => {
    delete process.env.LICENSE_REVOKED;
  });

  it("round-trips a signed licence", () => {
    const v = verifyLicense(signLicense(base));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.license.email).toBe("ada@example.com");
  });

  it("rejects missing, malformed and tampered tokens", () => {
    expect(verifyLicense(null)).toMatchObject({ ok: false, reason: "missing" });
    expect(verifyLicense("not-a-key")).toMatchObject({ ok: false, reason: "malformed" });
    const token = signLicense(base);
    const [body, sig] = token.slice(4).split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), plan: "team-lifetime", seats: 10 })).toString("base64url");
    expect(verifyLicense(`dfa_${forged}.${sig}`)).toMatchObject({ ok: false, reason: "signature" });
  });

  it("rejects expired and revoked licences", () => {
    expect(verifyLicense(signLicense({ ...base, plan: "pro-yearly", exp: Math.floor(Date.now() / 1000) - 60 }))).toMatchObject({ ok: false, reason: "expired" });
    const token = signLicense({ ...base, id: "revoke-me" });
    process.env.LICENSE_REVOKED = "other, revoke-me";
    expect(verifyLicense(token)).toMatchObject({ ok: false, reason: "revoked" });
  });

  it("reads the key from a Bearer header or the cookie", () => {
    const token = signLicense(base);
    expect(licenseFromRequest(new Request("https://x.test", { headers: { authorization: `Bearer ${token}` } }))).toBe(token);
    expect(licenseFromRequest(new Request("https://x.test", { headers: { cookie: `a=1; dfa_license=${encodeURIComponent(token)}` } }))).toBe(token);
    expect(licenseFromRequest(new Request("https://x.test"))).toBeNull();
  });
});
