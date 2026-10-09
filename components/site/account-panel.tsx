"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { CopyButton } from "./copy-button";

type License = { email: string; plan: string; seats: number; exp: number | null; id: string };
type State = { status: "loading" } | { status: "none" } | { status: "active"; license: License; token: string };

const PLAN_NAMES: Record<string, string> = {
  "pro-yearly": "Pro · yearly",
  "pro-lifetime": "Pro · lifetime",
  "team-yearly": "Team · yearly",
  "team-lifetime": "Team · lifetime",
};

export function AccountPanel({ welcome }: { welcome: boolean }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/license/me", { cache: "no-store" });
    const j = await r.json();
    setState(j.active ? { status: "active", license: j.license, token: j.token } : { status: "none" });
  }

  useEffect(() => {
    load().catch(() => setState({ status: "none" }));
  }, []);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/license/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: key.trim() }) });
      if (r.ok) {
        setKey("");
        await load();
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.reason === "expired" ? "That licence has expired. Renew from the pricing page to get a fresh key." : "That doesn't look like a valid licence key. Check you copied all of it.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/license/logout", { method: "POST" });
    setState({ status: "none" });
  }

  if (state.status === "loading") {
    // The same two panels the signed-out view lands in, so nothing jumps when it resolves.
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Checking for a licence">
        {[0, 1].map((i) => (
          <div key={i} className="site-surface h-72 rounded-[24px] p-7 sm:p-8">
            <div className="h-6 w-3/5 rounded-md bg-white/[0.05]" />
            <div className="mt-4 h-3 w-4/5 rounded bg-white/[0.04]" />
            <div className="mt-2.5 h-3 w-2/3 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "none") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={activate} className="site-surface site-in rounded-[24px] p-7 [--i:2] sm:p-8">
          <h2 className="text-2xl font-semibold tracking-[-0.035em]">Activate a licence on this device</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-site-fg-2">Paste the key from your account page on the device you bought on. It starts with <code className="rounded-md border border-white/[0.08] bg-white/[0.05] px-1.5 py-px font-mono text-[13px] text-site-fg">dfa_</code>.</p>
          <label htmlFor="licence" className="sr-only">
            Licence key
          </label>
          <textarea
            id="licence"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="dfa_eyJ2IjoxLCJpZCI6…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "licence-error" : undefined}
            className={`mt-5 w-full resize-none rounded-2xl border bg-site-bg px-4 py-3 font-mono text-[13px] text-site-fg outline-none transition-colors duration-150 placeholder:text-site-fg-3 hover:border-white/[0.14] focus:border-white/25 ${error ? "border-site-danger/50" : "border-white/[0.08]"}`}
          />
          {error && (
            <p id="licence-error" role="alert" className="site-rise mt-2 text-sm text-site-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={!key.trim() || busy} aria-busy={busy} className="site-btn site-btn-primary mt-4 h-11 min-w-28 px-6 text-[14px]">
            {busy && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent opacity-70" />}
            {busy ? "Checking…" : "Activate"}
          </button>
        </form>
        <div className="site-surface site-in flex flex-col justify-between rounded-[24px] p-7 [--i:3] sm:p-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.035em]">No licence yet?</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-site-fg-2">Pro unlocks every component, the Pro prompts and the private registry. Pay once and keep it forever.</p>
          </div>
          <Link href="/pricing" className="site-btn site-btn-accent mt-8 h-11 w-fit px-6 text-[14px]">
            See Pro pricing
          </Link>
        </div>
      </div>
    );
  }

  const { license, token } = state;
  return (
    <div className="space-y-6">
      {welcome && (
        <div className="site-surface site-in flex gap-5 rounded-[24px] p-7 [--i:2] sm:p-8">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-site-accent text-black">
            <svg viewBox="0 0 16 16" className="size-4" fill="none">
              <path className="site-draw" d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-3xl font-semibold tracking-[-0.04em]">You have taste. Officially.</p>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-site-fg-2">Your Pro licence is active on this device. Your key is below; keep it somewhere safe and give it to your agents.</p>
          </div>
        </div>
      )}
      <div className="site-surface site-in rounded-[24px] p-7 [--i:3] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">Licence</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{PLAN_NAMES[license.plan] ?? license.plan}</p>
            <p className="mt-1 text-[15px] text-site-fg-2">
              {license.email || "No email on file"} · {license.seats} {license.seats === 1 ? "seat" : "seats"} ·{" "}
              {license.exp ? `renews ${new Date(license.exp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "never expires"}
            </p>
          </div>
          <button type="button" onClick={logout} className="site-btn site-btn-secondary h-10 px-4 text-sm">
            Sign out of this device
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-site-bg/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-2">Your licence key</p>
            <CopyButton text={token} label="Copy key" />
          </div>
          <p className="mt-3 break-all font-mono text-[12px] leading-relaxed text-site-fg-2">{token}</p>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { t: "CLI", c: "npx design-for-ai login <your key>", d: "Then npx design-for-ai add <slug> works for Pro components too. Or set DESIGN_FOR_AI_LICENSE." },
          { t: "MCP server", c: "claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp --header \"Authorization: Bearer $DESIGN_FOR_AI_LICENSE\"", d: "Remote, nothing to install. Cursor and Windsurf take the same URL and header." },
          { t: "shadcn", c: "npx shadcn@latest add @design-for-ai-pro/<slug>", d: "After adding the Pro registry to components.json (see Docs)." },
        ].map((x, i) => (
          <div key={x.t} className="site-surface site-in min-w-0 rounded-[20px] p-5" style={{ "--i": 4 + i } as CSSProperties}>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">{x.t}</p>
            <p className="mt-3 overflow-x-auto whitespace-nowrap rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-[12px]">{x.c}</p>
            <p className="mt-3 text-sm leading-relaxed text-site-fg-2">{x.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
