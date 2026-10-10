import { describe, expect, it } from "vitest";
import { handleMessage, TOOLS } from "@/lib/mcp";

const anon = { license: { ok: false as const, reason: "missing" as const } };
const call = (name: string, args: Record<string, unknown> = {}, ctx = anon) =>
  handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ctx) as Promise<{
    result: { content: { text: string }[]; isError?: boolean };
  }>;

describe("remote MCP server", () => {
  it("negotiates the protocol version", async () => {
    const r = (await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, anon)) as { result: { protocolVersion: string; capabilities: object } };
    expect(r.result.protocolVersion).toBe("2025-06-18");
    expect(r.result.capabilities).toHaveProperty("tools");
    const u = (await handleMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, anon)) as { result: { protocolVersion: string } };
    expect(u.result.protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ignores notifications and rejects unknown methods", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, anon)).toBeNull();
    const r = (await handleMessage({ jsonrpc: "2.0", id: 3, method: "nope" }, anon)) as { error: { code: number } };
    expect(r.error.code).toBe(-32601);
  });

  it("lists tools with JSON Schema inputs", async () => {
    const r = (await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/list" }, anon)) as { result: { tools: { name: string; inputSchema: { type: string } }[] } };
    expect(r.result.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    for (const t of r.result.tools) expect(t.inputSchema.type).toBe("object");
  });

  it("searches", async () => {
    const r = await call("search_components", { query: "chart" });
    expect(r.result.content[0].text).toContain("chart-portfolio");
  });

  it("serves free source without a licence", async () => {
    const r = await call("get_component", { slug: "chart-portfolio", include: ["code"] });
    expect(r.result.content[0].text).toContain("```tsx");
  });

  it("never serves Pro source without a licence", async () => {
    const r = await call("get_component", { slug: "chart-candlestick" });
    expect(r.result.content[0].text).not.toContain("## Source");
    expect(r.result.content[0].text).not.toContain("## Design prompt");
    expect(r.result.content[0].text).not.toContain("## JSON prompt");
    expect(r.result.content[0].text).toContain("Pro component");
  });

  it("lists tunable controls, for Pro components too", async () => {
    const free = await call("get_component", { slug: "button-hold-confirm", include: ["controls"] });
    expect(free.result.content[0].text).toContain("## Controls");
    expect(free.result.content[0].text).toMatch(/`duration` \(Hold for, slider\): 500–3000 ms/);
    const pro = await call("get_component", { slug: "three-voice-orb" });
    expect(pro.result.content[0].text).toContain("## Controls");
    expect(pro.result.content[0].text).toContain("runtime state");
    expect(pro.result.content[0].text).not.toContain("## Source");
  });

  it("reads site pages as Markdown", async () => {
    const r = await call("get_page", { path: "pricing" });
    expect(r.result.content[0].text).toContain("# Pricing");
  });

  it("flags unknown slugs as tool errors", async () => {
    const r = await call("get_component", { slug: "does-not-exist" });
    expect(r.result.isError).toBe(true);
  });
});
