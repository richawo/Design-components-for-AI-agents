import { afterEach, expect, it, vi } from "vitest";
import { fetchProAccess } from "@/lib/pro-access-client";
afterEach(() => vi.unstubAllGlobals());

it("coalesces simultaneous access checks and rechecks after a session changes", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response('{"active":false}'))
    .mockResolvedValueOnce(new Response('{"active":true}'));
  vi.stubGlobal("fetch", request);
  const first = fetchProAccess();
  expect(fetchProAccess()).toBe(first);
  expect(await first).toBe(false);
  expect(await fetchProAccess()).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0][0]).toBe("/api/license/me");
});
it("does not turn a temporary failure or malformed payload into an access denial", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(new Response('{"unrelated":true}'))
    .mockResolvedValueOnce(new Response('{"active":false}'));
  vi.stubGlobal("fetch", request);
  await expect(fetchProAccess()).rejects.toThrow();
  await expect(fetchProAccess()).rejects.toThrow();
  expect(await fetchProAccess()).toBe(false);
});
