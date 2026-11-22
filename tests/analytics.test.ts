import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { collect, parseBatch } from "@/lib/analytics/collector";
import { classifyPath, describeAgent, isBot, sanitizeProps } from "@/lib/analytics/events";
import { dataPoint, deliver, mixpanelEvent, type FunnelRecord } from "@/lib/analytics/sink";
import { proxy } from "@/proxy";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15";
const DEVICE = "11111111-2222-4333-8444-555555555555";
const SESSION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://design.yaps.ai/_dfa/e", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { origin: "https://design.yaps.ai", "user-agent": UA, "content-type": "text/plain", ...headers },
  });
}
const batch = (events: unknown[]) => ({ v: 1, d: DEVICE, u: null, s: SESSION, events });
const event = (e: string, p: Record<string, unknown> = {}) => ({ e, t: Date.now(), id: crypto.randomUUID(), p });

describe("page classification", () => {
  it("recognises every funnel page, including localized blog editions", () => {
    expect(classifyPath("/")).toEqual({ pageType: "home", slug: null, locale: "en" });
    expect(classifyPath("/blog")).toMatchObject({ pageType: "blog_index" });
    expect(classifyPath("/blog/page/2")).toMatchObject({ pageType: "blog_index" });
    expect(classifyPath("/de/blog/voice-ui-guide")).toEqual({ pageType: "blog_post", slug: "voice-ui-guide", locale: "de" });
    expect(classifyPath("/blog/category/guides")).toEqual({ pageType: "blog_category", slug: "guides", locale: "en" });
    expect(classifyPath("/fr/pricing")).toEqual({ pageType: "pricing", slug: null, locale: "fr" });
    expect(classifyPath("/components/chart-portfolio")).toMatchObject({ pageType: "component", slug: "chart-portfolio" });
    expect(classifyPath("/components")).toMatchObject({ pageType: "components_index" });
    expect(classifyPath("/account")).toMatchObject({ pageType: "account" });
    expect(classifyPath("/docs/principles")).toMatchObject({ pageType: "docs", slug: "principles" });
  });
});

describe("collector", () => {
  it("accepts known browser events and enriches them at the edge", () => {
    const records = parseBatch(JSON.stringify(batch([event("page_view", { path: "/pricing", page_type: "pricing" })])), request(""), { country: "GB", city: "London" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ event: "page_view", deviceId: DEVICE, sessionId: SESSION, userId: null, source: "web" });
    expect(records[0].props).toMatchObject({ path: "/pricing", mp_country_code: "GB", $city: "London", $browser: "Safari", $os: "Mac OS X", device_type: "desktop" });
  });

  it("drops unknown events, server-only events, bad ids and unsafe properties", () => {
    const records = parseBatch(JSON.stringify(batch([
      event("purchase_completed", { revenue: 9999 }),
      event("anything"),
      { e: "page_view", t: Date.now(), id: "x", p: {} },
      event("copied", { label: "Copy", nested: { a: 1 }, "Bad Key": 1, long: "y".repeat(1000) }),
    ])), request(""), {});
    expect(records.map((r) => r.event)).toEqual(["copied"]);
    expect(records[0].props.nested).toBeUndefined();
    expect(records[0].props["Bad Key"]).toBeUndefined();
    expect(sanitizeProps({ inf: Infinity, nan: NaN, ok: 2 })).toEqual({ ok: 2 });
    expect(String(records[0].props.long)).toHaveLength(300);
  });

  it("rejects a batch without a valid device id", () => {
    expect(parseBatch(JSON.stringify({ d: "nope", events: [event("page_view")] }), request(""), {})).toEqual([]);
    expect(parseBatch("not json", request(""), {})).toEqual([]);
  });

  it("ignores other origins and bots without revealing why", async () => {
    const write = vi.fn();
    const env = { FUNNEL_EVENTS: { writeDataPoint: write } };
    expect((await collect(request(batch([event("page_view")]), { origin: "https://evil.example" }), env)).status).toBe(204);
    expect((await collect(request(batch([event("page_view")]), { "user-agent": "Googlebot/2.1" }), env)).status).toBe(204);
    expect(write).not.toHaveBeenCalled();
    await collect(request(batch([event("page_view")])), env);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("is served by the public router without the Next server", async () => {
    const response = await proxy(new NextRequest("https://design.yaps.ai/_dfa/e", {
      method: "POST", body: JSON.stringify(batch([event("page_view")])), headers: { origin: "https://design.yaps.ai", "user-agent": UA },
    }));
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("sinks", () => {
  const record: FunnelRecord = {
    event: "purchase_completed", time: 1_800_000_000_000, insertId: "purchase:cs_test_1", deviceId: null, userId: "usr_123",
    sessionId: null, source: "server", props: { plan: "pro-lifetime", revenue: 179, page_type: "account" },
  };

  it("keeps Analytics Engine columns in their documented order", () => {
    const point = dataPoint(record);
    expect(point.blobs[0]).toBe("purchase_completed");
    expect(point.blobs[5]).toBe("usr_123");
    expect(point.blobs[12]).toBe("pro-lifetime");
    expect(point.blobs[16]).toBe("server");
    expect(point.blobs).toHaveLength(20);
    expect(point.doubles).toEqual([1, 0, 0, 179, 0, 1_800_000_000_000]);
    expect(point.indexes).toEqual(["usr_123"]);
  });

  it("uses Mixpanel's simplified identity merge", () => {
    expect(mixpanelEvent(record, "tok").properties).toMatchObject({ token: "tok", distinct_id: "usr_123", $user_id: "usr_123", $insert_id: "purchase:cs_test_1" });
    const anonymous = mixpanelEvent({ ...record, userId: null, deviceId: DEVICE }, "tok").properties;
    expect(anonymous).toMatchObject({ distinct_id: `$device:${DEVICE}`, $device_id: DEVICE });
    expect(anonymous).not.toHaveProperty("$user_id");
  });

  it("sends to Mixpanel only with a token and never throws", async () => {
    const fetcher = vi.fn(async () => new Response("1"));
    await deliver({}, [record], fetcher as unknown as typeof fetch);
    expect(fetcher).not.toHaveBeenCalled();
    await deliver({ MIXPANEL_TOKEN: "tok" }, [record], fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith("https://api-eu.mixpanel.com/track?ip=0&strict=1", expect.objectContaining({ method: "POST" }));
    const failing = vi.fn(async () => { throw new Error("down"); });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deliver({ MIXPANEL_TOKEN: "tok", FUNNEL_EVENTS: { writeDataPoint: () => { throw new Error("x"); } } }, [record], failing as unknown as typeof fetch)).resolves.toBeUndefined();
    error.mockRestore();
  });
});

describe("helpers", () => {
  it("classifies agents and bots", () => {
    expect(describeAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1")).toEqual({ browser: "Safari", os: "iOS", deviceType: "mobile" });
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(isBot(UA)).toBe(false);
  });
  it("sanitizes non-objects to nothing", () => {
    expect(sanitizeProps(null)).toEqual({});
    expect(sanitizeProps([1, 2])).toEqual({});
  });
});
