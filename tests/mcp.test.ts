import { describe, expect, it } from "vitest";
import { connectionNotice, handleMessage, TOOLS } from "@/lib/mcp";
import { keyIssue, mcpGet, mcpPost } from "@/lib/mcp-http";
import { allPosts } from "@/lib/content";

const anon = { license: { ok: false as const, reason: "missing" as const } };
const call = (name: string, args: Record<string, unknown> = {}, ctx = anon) =>
  handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ctx) as Promise<{
    result: { content: { text: string }[]; isError?: boolean };
  }>;

describe("remote MCP server", () => {
  it.skipIf(!allPosts("fr").length)("reads localised blog articles with canonical provenance through the anonymous page tool", async () => {
    const post = allPosts("fr")[0];
    const result = await call("get_page", { path: `fr/blog/${post.slug}` });
    expect(result.result.isError).not.toBe(true);
    expect(result.result.content[0].text).toContain(`canonical: https://design.yaps.ai/fr/blog/${post.slug}`);
    expect(result.result.content[0].text).toContain(`title: ${JSON.stringify(post.title)}`);
    const missing = await call("get_page", { path: "fr/blog/missing-article" });
    expect(missing.result.isError).toBe(true);
  });
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

describe("MCP connection notices", () => {
  const rpc = (headers: Record<string, string> = {}) => new Request("https://design.example.invalid/mcp/pro", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
  });

  it("names the setup mistake instead of silently serving the free tier", () => {
    expect(keyIssue(null)).toBeUndefined();
    expect(keyIssue("Bearer")).toBe("empty");
    expect(keyIssue("Bearer $DESIGN_FOR_AI_LICENSE")).toBe("unexpanded");
    expect(keyIssue("Bearer ${env:DESIGN_FOR_AI_LICENSE}")).toBe("unexpanded");
    expect(keyIssue("dfa_abc.def")).toBe("scheme");
    expect(keyIssue("Bearer dfa_abc.def", "expired")).toBe("expired");
    expect(keyIssue("Bearer dfa_abc.def", "signature")).toBe("invalid");
    expect(connectionNotice({ ...anon, keyIssue: "empty" })).toContain("DESIGN_FOR_AI_LICENSE");
    expect(connectionNotice({ ...anon, account: { email: "person@example.invalid" } })).toContain("no active Pro licence");
    expect(connectionNotice(anon)).toBeNull();
  });

  it("explains a rejected key in the Pro gate and the initialize instructions", async () => {
    const ctx = { ...anon, keyIssue: "invalid" as const };
    const r = await call("get_component", { slug: "chart-candlestick" }, ctx);
    expect(r.result.content[0].text).toContain("isn't valid");
    expect(r.result.content[0].text).toContain("/mcp/pro");
    expect(r.result.content[0].text).not.toContain("## Source");
    const open = await mcpPost(rpc({ Authorization: "Bearer not-a-key" }), "open");
    expect(open.status).toBe(200);
    expect((await open.json()).result.instructions).toContain("isn't valid");
  });

  it("challenges the signed-in endpoint so clients start browser sign-in", async () => {
    const missing = await mcpPost(rpc(), "signed-in");
    expect(missing.status).toBe(401);
    expect(missing.headers.get("WWW-Authenticate")).toContain('resource_metadata="https://design.example.invalid/.well-known/oauth-protected-resource/mcp/pro"');
    const rejected = await mcpPost(rpc({ Authorization: "Bearer dfa_bad.key" }), "signed-in");
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("WWW-Authenticate")).toContain('error="invalid_token"');
    expect((await mcpGet(new Request("https://design.example.invalid/mcp/pro"), "signed-in")).status).toBe(401);
    expect((await mcpGet(new Request("https://design.example.invalid/mcp"), "open")).status).toBe(405);
  });
});
