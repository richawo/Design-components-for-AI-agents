import { afterEach, expect, it, vi } from "vitest";
import { fetchProSource, SourceLoadError } from "@/lib/pro-source-client";

afterEach(() => vi.unstubAllGlobals());

it("distinguishes an entitlement denial from a temporary failure and retries the latter", async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(new Response("", { status: 403 }))
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: "example", codeHtml: "example", prompt: "brief", promptJson: "{}", promptJsonHtml: "{}" })));
  vi.stubGlobal("fetch", request);
  expect(await fetchProSource("denied-fixture")).toBeNull();
  await expect(fetchProSource("retry-fixture")).rejects.toBeInstanceOf(SourceLoadError);
  expect(await fetchProSource("retry-fixture")).toHaveProperty("code", "example");
  expect(request).toHaveBeenCalledTimes(3);
});

it("coalesces panel requests and does not cache a malformed response as licensed source", async () => {
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ unexpected: true })));
  vi.stubGlobal("fetch", request);
  const a = fetchProSource("malformed-fixture");
  const b = fetchProSource("malformed-fixture");
  expect(a).toBe(b);
  await expect(a).rejects.toBeInstanceOf(SourceLoadError);
  expect(request).toHaveBeenCalledTimes(1);
});
