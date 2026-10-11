import { afterEach, describe, expect, it, vi } from "vitest";
import { accountPost, codeDigits, pasteCode } from "../lib/account-client";

afterEach(() => vi.unstubAllGlobals());

describe("email-code entry", () => {
  it("accepts a formatted full code at any selection, without dropping digits", () => {
    expect(pasteCode("12", "314 159", 1, 1)).toBe("314159");
    expect(pasteCode("999999", "314-159", 3, 4)).toBe("314159");
    expect(codeDigits("3a14b159")).toBe("314159");
  });
  it("respects partial replacement and ignores a paste without digits", () => {
    expect(pasteCode("314159", "26", 2, 4)).toBe("312659");
    expect(pasteCode("314", "abc", 0, 3)).toBe("314");
  });
});

describe("account requests", () => {
  it("retains the server status so an invalid code differs from a connection failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Code expired" }, { status: 401 })));
    await expect(accountPost("/api/auth/verify", { code: "314159" })).rejects.toMatchObject({ status: 401, message: "Code expired" });
  });
  it("gives a safe retry message for network failures and non-JSON server responses", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("internal details")).mockResolvedValueOnce(new Response("gateway error", { status: 502 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(accountPost("/api/auth/request", {})).rejects.toMatchObject({ status: 0, message: "Couldn't connect. Check your connection and try again." });
    await expect(accountPost("/api/auth/request", {})).rejects.toMatchObject({ status: 502, message: "That request couldn't be completed. Please try again." });
  });
});
